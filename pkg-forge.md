# Package Forge Plan: cl-andro Custom Terminal Environment

This document defines the package alignment problem for the custom `cl-andro` shell, explains why the `pkg` command is missing, and sets up a roadmap for compiling/forging all basic and advanced package suites needed for a full development environment.

---

## 1. Problem Identification: Why `pkg` is Not Found

In a custom Termux fork like `cl-andro`, the prefix path of all executables, configuration files, and libraries is compiled with `/data/data/com.zk.clandro/files/usr` (or `/data/user/0/com.zk.clandro/files/usr`).

When running `pkg install nano` or `pkg update`:
1. **Missing `pkg` Wrapper**: The `pkg` utility itself is not a native command; it is a wrapper shell script provided by the `termux-tools` package. Since `termux-tools` has not been compiled and packaged into the initial bootstrap zip (`bootstrap-aarch64.zip`), the `pkg` command is not available (throwing `command not found`).
2. **Incorrect Mirror Prefix**: The default `sources.list` in the current bootstrap still points to the official Termux mirror (`deb https://packages-cf.termux.dev/apt/termux-main/ stable main`). Binaries downloaded from this official mirror are compiled for `/data/data/com.termux/` and will fail to execute under `cl-andro` due to hardcoded dynamic link paths and libraries.

All packages (including shell tools, git, python, editors, etc.) **must be forged (compiled) locally or in GitHub Actions** specifically targeting the `/data/data/com.zk.clandro` prefix.

---

## 2. Currently Forged Packages (Aarch64)

The following packages have already been successfully compiled and exist as `.deb` archives in the `cl-andro-bootstrap` repository:

* **OS Core/Bedrock**: `apt`, `dpkg`, `bash`, `coreutils`, `tar`, `gzip`, `bzip2`, `zstd`, `xz-utils`, `findutils`, `grep`, `sed`, `gawk`, `readline`, `ncurses`, `util-linux`, `libandroid-support`, `libandroid-glob`, `libandroid-selinux`, `libc++`.
* **Database & Languages**: `python`, `python-ensurepip-wheels`, `sqlite`, `tcl`, `nodejs`, `npm-patch`.
* **Libraries & Cryptography**: `openssl`, `libcurl`, `libssh2`, `libnghttp2`, `libnghttp3`, `libgcrypt`, `libgpg-error`, `libxml2`, `libxslt`.
* **Version Control**: `git`, `git-svn`, `git-gui`, `git-gitk`.
* **Prone Execution**: `proot`, `proot-distro`.

---

## 3. Surgical Forge Action Plan

We must build and install the missing bedrock utilities to enable package management on the device.

### Phase 1: Core Essentials & Editors (Basics)
We need to forge the following packages next to enable the `pkg` command wrapper and standard command-line editing:

| Package | Purpose | Dependencies to Forge |
| :--- | :--- | :--- |
| **`dialog`** | TUI dialog boxes (required by termux-tools config) | `ncurses` |
| **`termux-core`** | System hooks & properties integration | None |
| **`termux-exec`** | `LD_PRELOAD` exec wrapper for script shebang redirection | `termux-core` |
| **`termux-am`** | Activity Manager helper for terminal interactions | None |
| **`termux-tools`** | **Provides the `pkg` command wrapper** | `dialog`, `coreutils`, `curl`, `termux-am` |
| **`nano`** | Easy-to-use CLI text editor | `ncurses`, `libandroid-support` |

> [!NOTE]
> I have created the new GitHub Action workflow [forge-essentials.yml](file:///home/alamgir-zk/Cluster-Family/clandro-pkg/.github/workflows/forge-essentials.yml) inside `clandro-pkg` to automate the Phase 1 build pipeline.

### Phase 2: Advanced Development Tools
Once basics are installed, we will proceed to forge:

1. **`build-essential`** (`gcc`/`clang`, `make`, `pkg-config`, `libtool` for compiling on device).
2. **`golang`** (Go compiler for terminal toolchains).
3. **`neovim`** / **`vim`** (Advanced terminal code editing).
4. **`curl`** & **`wget`** (Network fetching).

---

## 4. Rebuilding and Repackaging the Bootstrap

Once the `.deb` files are built via GitHub Actions (or locally using `./build-package.sh`), they must be integrated into `cl-andro`:

1. Copy the new `.deb` files to the `/home/alamgir-zk/Cluster-Family/cl-andro-bootstrap/` directory.
2. Run the `forge.sh` script to unpack binaries, construct `SYMLINKS.txt`, and assemble `bootstrap-aarch64.zip`:
   ```bash
   cd /home/alamgir-zk/Cluster-Family/cl-andro-bootstrap
   ./forge.sh
   ```
3. Point your local `cl-andro` app distribution configuration to package and distribute the new `bootstrap-aarch64.zip`.

---

## 5. Security Plan: Unified GPG Signing & Package Verification

> [!CAUTION]
> Using `[trusted=yes]` in `sources.list` is a temporary shortcut for local development testing. **Never launch production software with this setting.** Without GPG signature enforcement, a hacker could hijack your domain, poison your DNS, or spoof your repository to trick users into downloading malicious packages (e.g., a backdoored `bash` or `git` binary) that can read private terminal files, access keys, or compromise their device.

To prevent phishing and package spoofing, we will implement a GPG signing verification pipeline before the software launch.

### Architectural Diagram: Secure Package Verification
```mermaid
graph TD
    subgraph Build Machine / GitHub Actions
        PrivateGPG["Private GPG Key (Secure Secrets)"] -->|Signs Release file| ReleaseGPG["Release.gpg & InRelease"]
    end
    subgraph GitHub Pages Hosting
        Debs[".deb Binaries"]
        Packages["Packages.gz"]
        ReleaseGPG
    end
    subgraph User Phone (cl-andro app)
        PublicGPG["Public GPG Key keyring (Pre-installed in /etc/apt/trusted.gpg.d/)"]
        AptUpdate["apt update / pkg update"] -->|Downloads| ReleaseGPG
        ReleaseGPG -->|Verifies signature against| PublicGPG
        PublicGPG -->|If Valid| InstallPkg["Install Package (.deb)"]
        PublicGPG -->|If Invalid / Fake Key| BlockPkg["ABORT: Unsigned / Malicious package blocked!"]
    end
```

### Step-by-Step Security Implementation

#### Step 5.1: Generate the Sovereign GPG Key Pair
On your secure build machine, generate a dedicated master key pair for the `cl-andro` package repository:
```bash
gpg --full-generate-key
```
* Select **RSA and RSA (default)**.
* Use key size **4096** bits.
* Set expiration to **0** (key does not expire) or a reasonable time frame (e.g., 5 years).
* Name it `cl-andro Security Team <security@cl-andro.org>`.

#### Step 5.2: Create and Package the Public Keyring
Export the public key in binary format so `apt` can read it directly:
```bash
gpg --output cl-andro-keyring.gpg --export security@cl-andro.org
```
1. Create a custom package in `clandro-pkg` called `cl-andro-keyring`.
2. Configure this package to place `cl-andro-keyring.gpg` inside:
   `/data/data/com.zk.clandro/files/usr/etc/apt/trusted.gpg.d/cl-andro.gpg`
3. Include this `.deb` package inside the initial bootstrap payload (`bootstrap-aarch64.zip`) so it is pre-installed.

#### Step 5.3: Update `publish-repo.sh` to Auto-Sign Releases
Modify the deployment script to generate the `Release` index and sign it with the private GPG key:
```bash
# 1. Create Release metadata listing the hashes of Packages & Packages.gz
apt-ftparchive release dists/stable > dists/stable/Release

# 2. Create detached signature (Release.gpg)
gpg --default-key security@cl-andro.org -abs -o dists/stable/Release.gpg dists/stable/Release

# 3. Create inline signature (InRelease)
gpg --default-key security@cl-andro.org --clearsign -o dists/stable/InRelease dists/stable/Release
```

#### Step 5.4: Enforce Cryptographic Lock-Down on the Phone
Modify the default `sources.list` configuration in your bootstrap and compiler definitions to remove the `[trusted=yes]` tag, replacing it with the `signed-by` option pointing strictly to your public keyring:

```
deb [signed-by=/data/data/com.zk.clandro/files/usr/etc/apt/trusted.gpg.d/cl-andro.gpg] https://cl-andro.github.io/cl-andro-packages/ stable main
```

With this configured, any attempt to serve unsigned or improperly signed packages will be automatically blocked by `apt` on the user's phone, neutralizing repository hijacking and phishing threats.
