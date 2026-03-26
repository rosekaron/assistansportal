#!/bin/sh
# Re-apply node user password on each start (password stored in .env as NODE_PASSWORD)
echo "node:${NODE_PASSWORD}" | sudo chpasswd
