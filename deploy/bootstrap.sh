#!/usr/bin/env bash
# One-time Droplet setup, run as root on a fresh Ubuntu 24.04 Droplet:
#
#   ssh root@IP "CI_PUBKEY='$(cat /tmp/1337-ci/ci_key.pub)' bash -s" < deploy/bootstrap.sh
#
# (from the repo root; the CI key is made in deploy/README.md step 1)
#
# Installs Docker, adds swap, creates the `deploy` user (your login key from
# root's authorized_keys plus the CI key), then turns off root and password
# login. Keep the root session open until `ssh deploy@IP` works.
set -euo pipefail

die() { echo "bootstrap: $*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root"
[ -n "${CI_PUBKEY:-}" ] || die "set CI_PUBKEY to the CI key's public half"
case "$CI_PUBKEY" in ssh-ed25519\ *) ;; *) die "CI_PUBKEY is not an ed25519 public key" ;; esac
# The login key comes from root; without it, disabling root would lock you out.
[ -s /root/.ssh/authorized_keys ] || die "/root/.ssh/authorized_keys is empty; add your login key to the Droplet first"

export DEBIAN_FRONTEND=noninteractive

echo "== packages"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl unattended-upgrades

echo "== swap (1 GB)"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck source=/dev/null
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "== deploy user"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos '' deploy
# The docker group is root-equivalent; accepted for a throwaway demo box. No sudo.
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
{
  cat /root/.ssh/authorized_keys
  # `restrict`: no port/agent forwarding or pty for CI, commands only.
  echo "restrict $CI_PUBKEY"
} > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
install -d -m 750 -o deploy -g deploy /opt/1337

echo "== sshd"
# 00- sorts before cloud-init's 50-cloud-init.conf; the first value sshd reads wins.
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t
systemctl reload ssh

echo "bootstrap: done. In a new terminal check: ssh deploy@<IP> 'docker ps'"
