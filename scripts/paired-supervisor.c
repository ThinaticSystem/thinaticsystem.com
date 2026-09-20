#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/prctl.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

/* Linux-only command owner. No privilege changes or process-table scan.
 * A private subreaper adopts detached descendants when intermediate parents exit.
 * Killing and reaping only direct children repeatedly drains the entire owned tree.
 * ECHILD, not a successful kill syscall, is the cleanup completion witness.
 */
static volatile sig_atomic_t interrupted = 0;
static void on_signal(int number) { interrupted = number; }
static long long now_ms(void) {
    struct timespec value;
    if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) _exit(125);
    return (long long)value.tv_sec * 1000 + value.tv_nsec / 1000000;
}
static void pause_tick(void) {
    struct timespec delay = {0, 10000000};
    nanosleep(&delay, NULL);
}
static int kill_direct_children(void) {
    char path[96];
    snprintf(path, sizeof(path), "/proc/self/task/%ld/children", (long)getpid());
    FILE *stream = fopen(path, "r");
    if (!stream) return errno;
    int error = 0;
    long pid;
    int read_result;
    /* SAFETY: this single-threaded owner does not reap while enumerating, so a
     * listed child PID cannot be recycled into an unrelated process before kill.
     */
    while ((read_result = fscanf(stream, "%ld", &pid)) == 1) {
        if (pid <= 1) { error = EINVAL; break; }
        if (kill((pid_t)pid, SIGKILL) != 0 && errno != ESRCH) error = errno;
    }
    if (ferror(stream) || read_result == 0) error = EIO;
    if (fclose(stream) != 0) error = errno;
    return error;
}
int main(int argc, char **argv) {
    if (argc < 4) return 125;
    char *end;
    errno = 0;
    long timeout_ms = strtol(argv[2], &end, 10);
    if (errno || *end || timeout_ms < 1 || timeout_ms > 480000) return 125;
    struct sigaction action = {0};
    action.sa_handler = on_signal;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGTERM, &action, NULL) || sigaction(SIGINT, &action, NULL)) return 125;
    pid_t owner = getppid();
    if (prctl(PR_SET_CHILD_SUBREAPER, 1L, 0L, 0L, 0L) ||
        prctl(PR_SET_PDEATHSIG, SIGTERM, 0L, 0L, 0L)) return 125;
    if (getppid() != owner) interrupted = SIGTERM;
    if (interrupted) return 125;
    int exec_error[2];
    if (pipe2(exec_error, O_CLOEXEC | O_NONBLOCK)) return 125;
    sigset_t blocked, previous;
    sigemptyset(&blocked); sigaddset(&blocked, SIGTERM); sigaddset(&blocked, SIGINT);
    if (sigprocmask(SIG_BLOCK, &blocked, &previous)) return 125;
    pid_t supervisor_pid = getpid();
    pid_t child = fork();
    if (child == 0) {
        close(exec_error[0]);
        struct sigaction reset = {0}; reset.sa_handler = SIG_DFL;
        sigemptyset(&reset.sa_mask);
        sigaction(SIGTERM, &reset, NULL); sigaction(SIGINT, &reset, NULL);
        prctl(PR_SET_PDEATHSIG, SIGKILL, 0L, 0L, 0L);
        sigprocmask(SIG_SETMASK, &previous, NULL);
        if (getppid() != supervisor_pid) _exit(125);
        execvp(argv[3], &argv[3]);
        int error = errno;
        if (write(exec_error[1], &error, sizeof(error)) != sizeof(error)) _exit(126);
        _exit(127);
    }
    int spawn_error = child < 0 ? errno : 0;
    sigprocmask(SIG_SETMASK, &previous, NULL);
    close(exec_error[1]);
    int root_status = 0;
    bool root_reaped = false;
    bool timed_out = false;
    int cleanup_error = 0;
    long long deadline = now_ms() + timeout_ms;
    while (child > 0 && !interrupted) {
        pid_t ended = waitpid(child, &root_status, WNOHANG);
        if (ended == child) { root_reaped = true; break; }
        if (ended < 0 && errno != EINTR) { cleanup_error = errno; break; }
        if (now_ms() >= deadline) { timed_out = true; break; }
        pause_tick();
    }
    bool empty = false;
    deadline = now_ms() + 5000;
    while (now_ms() < deadline) {
        int error = kill_direct_children();
        if (error) cleanup_error = error;
        int status;
        pid_t ended;
        while ((ended = waitpid(-1, &status, WNOHANG)) > 0) {
            if (ended == child) { root_status = status; root_reaped = true; }
        }
        if (ended < 0 && errno == ECHILD) { empty = true; break; }
        if (ended < 0 && errno != EINTR) cleanup_error = errno;
        pause_tick();
    }
    if (!empty && !cleanup_error) cleanup_error = ETIMEDOUT;
    int error = 0;
    ssize_t size = read(exec_error[0], &error, sizeof(error));
    if (size == sizeof(error)) spawn_error = error;
    else if (size != 0) cleanup_error = EIO;
    close(exec_error[0]);
    bool cleanup = empty && !cleanup_error;
    /* A separate exclusive receipt preserves the command exit even though the
     * supervisor exits zero only for a verified supervision/cleanup transaction.
     */
    int fd = open(argv[1], O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
    if (fd < 0) return 125;
    FILE *receipt = fdopen(fd, "w");
    if (!receipt) { close(fd); return 125; }
    fprintf(receipt, "{\"schema\":1,\"status\":");
    if (root_reaped && WIFEXITED(root_status)) fprintf(receipt, "%d", WEXITSTATUS(root_status));
    else fprintf(receipt, "null");
    fprintf(receipt, ",\"signal\":");
    if (root_reaped && WIFSIGNALED(root_status)) fprintf(receipt, "%d", WTERMSIG(root_status));
    else fprintf(receipt, "null");
    fprintf(receipt, ",\"timedOut\":%s,\"interrupted\":%d,\"spawnErrno\":%d,\"cleanup\":%s,\"cleanupErrno\":%d}\n",
            timed_out ? "true" : "false", (int)interrupted, spawn_error,
            cleanup ? "true" : "false", cleanup_error);
    bool write_failed = ferror(receipt);
    if (fclose(receipt)) write_failed = true;
    return cleanup && !write_failed ? 0 : 125;
}
