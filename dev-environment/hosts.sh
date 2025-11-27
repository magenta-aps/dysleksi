#!/bin/bash

hosts_file="/hosts"

add_hosts=""
for hostname in dysleksi-web dysleksi-idp; do
  if ! grep $hostname $hosts_file; then
    add_hosts+=" $hostname"
  fi
done

if [ ! -z "$add_hosts" ]; then
    echo "127.0.0.1       $add_hosts    # dysleksi hosts" >> $hosts_file
fi
