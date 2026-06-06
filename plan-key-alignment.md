# Plan: Keystore Alignment for Cluster Family Apps

This document defines the signature alignment problem encountered during development and provides a plan to establish a unified custom signing system for all applications in the Cluster Family.

---

## The Problem Definition

To allow developers to easily edit code files in the workspace, we linked the **GitSocial (`cl-andro`)** application sandbox directly with the **cluster-files** Android text editor. 

To achieve this without requiring root privileges, we set up a shared user ID in `AndroidManifest.xml` for `cluster-files`:
```xml
android:sharedUserId="com.zk.clandro"
```

In Android, sharing a user ID allows apps to run in the same process and access each other's private data directories (`/data/data/com.zk.clandro`). However, **Android enforces a strict security restriction**:
* All applications sharing a `sharedUserId` **must be signed with the exact same certificate (signing key)**.
* Initially, `cluster-files` was compiled with the standard Android debug key (`~/.android/debug.keystore`), while the installed version of `cl-andro` was signed with a custom test key (`testkey_untrusted.jks`).
* This difference caused the installation of `cluster-files` to fail with `INSTALL_FAILED_SHARED_USER_INCOMPATIBLE` (Reconciliation failed: Package com.zk.clfiles has no signatures that match those in shared user com.zk.clandro).

### Keystore Locations
* **Original source of key**: `/home/alamgir-zk/Cluster-Family/cl-andro-app/app/testkey_untrusted.jks`
* **Aligned destination for cluster-files**: `/home/alamgir-zk/Cluster-Family/cluster-files/app/testkey_untrusted.jks`

---

## Action Plan: Unified Key Alignment Before Software Launch

> [!IMPORTANT]
> A unified, secure custom signing configuration must be fully established and integrated into all Cluster Family build configurations **before launching the software to end users**. Changing an app's signature after it has been installed requires a complete uninstall, which wipes all user repositories and configuration data.

### Step 1: Create a Secure, Unified Keystore
Instead of using `testkey_untrusted.jks` (which is designated for untrusted/debug builds), generate a dedicated, secure production release keystore (e.g., `cluster_family_release.jks`) using `keytool`:
```bash
keytool -genkey -v -keystore cluster_family_release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias cluster_alias
```

### Step 2: Shared Keystore Properties
Store the release properties in a secure, unified configuration file or environment variables that can be accessed by both build environments during CI/CD.
For example, inside a shared `signing.properties`:
```properties
storeFile=../cluster_family_release.jks
storePassword=your_secure_keystore_password
keyAlias=cluster_alias
keyPassword=your_secure_key_password
```

### Step 3: Align Build Configurations
Configure the `build.gradle` of all packages in the Cluster Family to use this shared release configuration:
1. **`cl-andro`**
2. **`cluster-files`**
3. Any future native apps in the family.

### Step 4: Verification
Before final distribution, verify that both APKs share the exact same certificate SHA-256 fingerprint:
```bash
apksigner verify --print-certs app-debug.apk
```
Confirm the SHA-256 fingerprint is identical for all applications in the suite.
