---
title: '"/proc" file system | Enumerating for a foothold'
tags:
  - linux
  - ctf
  - attack
date: 2023-03-30 12:00:00
excerpt: "A look into the \"/proc\" file system and how can an adversary leverage it for enumeration."
banner_img: /img/proc_contents.png
index_img: /img/proc_contents.png
---
## What is "/proc"?

The `proc` file system, which usually lies in `/proc` directory of a Linux system, contains information about the runtime of the system and all processes on the system. This information is stored in the form of files or file-like objects which can be read from using simple text readers such `cat` or `grep` and can be modified by high-privileged users and process for different purposes.

In case of a vulnerability like **LFI (Local File Inclusion)**, **command injection** or similar vector, this makes it a useful location for recon/enumeration for an attacker or from a CTF standpoint which I can personally relate to when solving challenges.

## A little scenario

Throughout this post, I will be using a *smol* **python Flask** app that is deliberately vulnerable to an LFI to demonstrate the attack vector. The code for the web app is given below, make sure to run it in a contained environment:

```python
from flask import Flask, request
app = Flask(__name__)

@app.route('/')
def index():
    return 'Hello there!\n'

@app.route('/read')
def read():
    file = request.args.get('fn')
    with open(f'/tmp/{file}', 'rb') as f: # Classic LFI
        data = f.read()
        return data

if __name__ == '__main__':
    app.run()
```

If you haven't already installed **Flask** library, you can do so by executing the command:

```shell
pip install Flask
```

For demonstration, I'm using the `export` command to create a few environment variables before we run the application. To so this and run the script, we can execute the following:

```shell
export SOME_VAR="aVariableHere" \
SECRET="YouShouldntBeReadingThis" \
VERSION="6.9.0" \
DB_URL='mysql://dbuser:P@$$w0rd@localhost/webapp'; flask --app app run
```

Make sure to execute the command in the same directory as the script. If executed successfully, our vulnerable web app should be listening for new connections.

![Flask app configured and listening](../img/flask_start.png)

## The attack begins

First things first, let's confirm the LFI by querying the classic `/etc/passwd`. If we look at the source code again, the app is trying to read from `/tmp` with the filename passed **directly** in to the expression without any sanitation. We only need a single set of `..` operator to access the file system root. So our malicious query will be:

```shell
curl 'localhost:5000/read?fn=../etc/passwd'
```

![The content of /etc/passwd as the response](../img/flask_etc_passwd.png)

Great! (or not so great *wink*) This means that we can now read all files in the systems which can be read by the system account running the web app. An attacker can now try to read other various configuration files that presumably on default locations or other files and gather as much as information to gain a foothold.

### "/proc" structure

- You can break down the entries into two major categories. One is **kernel (or system) information** and **process specific information**.
- The numbered directories you see are made for each process, thus contains process information. The number represents the process ID (PID) of individual process.
- The remaining directories and file-like objects contains kernel information (but there are 4 interesting exceptions which will be discussed below).
- Another interesting fact is that the `/proc` **occupies no disk space at all (or at least a very minimal amount)**, the kernel (or the system) generates the necessary information dynamically when a programs access specific entries within `/proc`.
- With the exceptions of few entries, the contents of `/proc` are globally readable. But as an attacker, we only have to look at few interesting entries.

![Contents of /proc](../img/proc_contents.png)

{% note success %}
This post will go over some entries briefly. You can read on the complete documentation for `/proc` file system and its entries from the **Linux documentation**[^1] or from **man pages**[^2] in your own terminal. More links are available at the end of the post.
{% endnote %}

{% note info %}
In this scenario, we are using an LFI vulnerability to read files off the system. We can read **entries (files or file-like objects)** in `/proc` and in other parts of the file system, but we cannot read **directories** which is the expected behavior. However, a capable attacker can automate a brute-force attack with a list of possible file/directory names to discover files in the file system.
{% endnote %}

### Kernel information

- `/proc/cpuinfo`
  - Returns information regarding individual CPU cores available to the system. (Response can be quite long depending on the number of cores)

![Response of /proc/cpuinfo (truncated)](../img/proc_cpuinfo.png)

- `/proc/meminfo`
  - Returns information about the system memory. This includes total memory, used memory, free memory, etc.

![Response of /proc/meminfo (truncated)](../img/proc_meminfo.png)

- `/proc/version`
  - Returns the kernel version information.

![Response of /proc/version](../img/proc_version.png)

- `/proc/partitions`
  - Returns the partition table known to the system.

![Response of /proc/partitions](../img/proc_partitions.png)

As mentioned in [/proc structure](#proc-structure), there a few interesting links that's available within the `/proc`. They are listed below:

- `/proc/self`
  - This is a *magical* link that automatically points to the relevant `/proc/<PID>/` **directory** of the process(s) that's currently accessing the entry. This is made as a convenient way of accessing own process information. Can be easily used in attacks such as LFI to quickly expose information about the current process.

- `/proc/mounts`
  - Like `/proc/self`, this link points to the `/proc/<PID>/mounts` entry of the own process. This contains information about the file system mounts that accessible by the process (Refer `/proc/mounts` in man pages[^2]). This can include network shares that are mounted on the system.
  - For example, below you can see a mount that is created by [KDE Connect](https://kdeconnect.kde.org/) that is exposing some folders in my android device. In the next screenshot, I'm accessing the `Documents/message.txt` that results in information disclosure.

![Response of /proc/mounts](../img/proc_mounts.png)

![Secrets exposed!!!](../img/secret_message.png)

- `/proc/net/`
  - Like `/proc/mounts`, this link points to the `/proc/<PID>/net/` **directory** of the own process. The entries within this directory holds different kinds of information about the networking stack that is accessible by the process (Refer `/proc/net` in man pages[^2]).
  - For example, `arp` entry holds the ARP cache of the system which can be used to discover internal hosts of the network. `tcp` and `udp` entries have relevant connections that are established or listening on the system (in hex format).

![Response of /proc/net/arp](../img/proc_net_arp.png)

- `/proc/threads-self`
  - Like the above magic links, this point to the relevant `/proc/<PID>/task/<TID>/` **(process thread) directory** of the own process, if it is being accessed by a thread. The TID here is similar to PID and threads are accessible via `/proc/<TID>` as well. However, threads are different from processes in computing.

![Threads in my "Terminator" session](../img/proc_task.png)

### Process information

{% note info %}
In this scenario, we can use `/proc/self/` link to expose information about the web app process without guessing the PID. But it is possible to brute-force PID to find processes of interest.
{% endnote %}

- `/proc/<PID>/comm` & `/proc/<PID>/cmdline`
  - `comm` and `cmdline` holds the base name of the command and the complete command used to execute the command respectively. `cmdline` will spit out the whole with the spaces in between arguments replaced by a null byte '\0'. We can pass this through a replace function to restore the spaces. What's important here that the command line arguments can contain password (This is bad practice).

![Response of /proc/self/cmd & /proc/self/cmdline](../img/proc_cmd.png)

- `/proc/<PID>/status`
  - This entry contains an array of different kinds of information. `Name`, `Pid`, `PPid` (Parent PID), `Uid` (Effective user ID), `Gid` (Effective group ID) and `Groups` (Groups the process belongs to) are some important fields out of it for enumeration.

![Response of /proc/self/status](../img/proc_status.png)

- `/proc/<PID>/environ`
  - This is the **most important one** in my opinion. This holds the *initial* environment variables that was used to execute the process with. By initial, it means that if any changes happen to these during the process lifetime, it won't be reflected here.
  - Often for production or in development, environment variables are used to hold configuration information and usually these contain sensitive information like secret keys, authentication tokens, database credentials, etc.
  - For example, we have our dummy variables we set up earlier dumped here (the newlines '\n' are replaces by null bytes '\0' here as well) (I have also truncated the output to get rid of the unnecessary variables of my ZSH config).

![Response of /proc/self/environ](../img/proc_environ.png)

- `/proc/<PID>/cwd/`
  - This a symbolic link that points to the **current working directory** of the process. Can sometimes be used as a shortcut in context of web app path.

![Content of /proc/self/cwd/](../img/proc_cwd.png)

- `/proc/<PID>/exe`
  - This entry points directly to the executable command that is used run the command. Reading this will output raw binary data. Useful when you are dealing with custom standalone binaries during challenges.

![Content of /proc/self/exe](../img/proc_exe.png)

- `/proc/<PID>/fd/`
  - This **directory** contains symbolic links to each file that are open in the process, named using numbers (Numbers correlate to the entries in `fdinfo/` directory). Except the first three (0, 1, 2) which are standard input, output, error respectively, files can be queried to view the contents inside it. Sometimes it can be used to execute code in context of the web app[^3].

![Content of /proc/self/fd/](../img/proc_fd.png)

## Concluding thoughts

That's about it for my first blog post :) This post covered a few interesting locations in the Linux `/proc` file system that an attacker with some read access on the system during compromise or even during post exploitation phase can enumerate to uncover information. You can refer the links in the below sections for more information about the topic.

But this is a small part of an attack chain. Depending on the context of the scenario, an attacker will think outside box to carry out the attack chain and compromise a system. **YOU** should think out of the box too.

Thank you for reading **o7**

![Cat hacking the system](https://media.tenor.com/KmPFMGQ07-4AAAAd/hffgf.gif)

## Extra reading

- [Linux enumeration with read access only](https://idafchev.github.io/enumeration/2018/03/05/linux_proc_enum.html)
- [Directory Traversal, File Inclusion, and The Proc File System](https://www.netspi.com/blog/technical/web-application-penetration-testing/directory-traversal-file-inclusion-proc-file-system/)

## References

[^1]: [The Linux Documentation Project](https://tldp.org/LDP/Linux-Filesystem-Hierarchy/html/proc.html)
[^2]: man 5 proc (in your terminal) or [man7 on the web](https://man7.org/linux/man-pages/man5/proc.5.html)
[^3]: [LFI to RCE via /proc/*/fd](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/File%20Inclusion/README.md#lfi-to-rce-via-procfd)
