{
  description = "ThinaticSystem.com reproducible JavaScript development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {self, nixpkgs}: let
    systems = ["x86_64-linux"];
    forEachSystem = nixpkgs.lib.genAttrs systems;
  in {
    devShells = forEachSystem (system: let
      pkgs = import nixpkgs {inherit system;};
      node = pkgs.nodejs_24;
      baselineNode = pkgs.nodejs_22;
      baselineNodeVersion = nixpkgs.lib.removeSuffix "\n" (builtins.readFile ./.baseline-node-version);
      nodeVersion = nixpkgs.lib.removeSuffix "\n" (builtins.readFile ./.node-version);
      # Keep tools that spawn bare pnpm on the same Corepack integrity-checked pin.
      pnpm = pkgs.writeShellScriptBin "pnpm" ''
        exec ${node}/bin/corepack pnpm "$@"
      '';
    in {
      default = assert node.version == nodeVersion; assert baselineNode.version == baselineNodeVersion; pkgs.mkShell {
        BASELINE_NODE_EXECUTABLE = "${baselineNode}/bin/node";
        packages = [node pnpm];
        shellHook = ''
          export NIX_NODE_VERSION="$(node --version)"
          export NIX_PNPM_VERSION="$(corepack pnpm --version)"
        '';
      };
    });
  };
}
