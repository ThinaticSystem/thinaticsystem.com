{
  description = "ThinaticSystem.com reproducible JavaScript development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {self, nixpkgs}: let
    systems = ["x86_64-linux"];
    forEachSystem = nixpkgs.lib.genAttrs systems;
  in {
    devShells = forEachSystem (system: let
      pkgs = import nixpkgs {inherit system;};
    in {
      default = pkgs.mkShell {
        packages = [pkgs.nodejs_22 pkgs.pnpm];
        shellHook = ''
          export NIX_NODE_VERSION="$(node --version)"
          export NIX_PNPM_VERSION="$(pnpm --version)"
        '';
      };
    });
  };
}
