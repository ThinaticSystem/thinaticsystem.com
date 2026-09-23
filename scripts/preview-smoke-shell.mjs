export function hasAngularShell(html) {
  return /<app-root(?=[\s/>])/i.test(html);
}
