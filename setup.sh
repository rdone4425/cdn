#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 打印彩色消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 检查是否有 git 命令
if ! command -v git &> /dev/null; then
    print_message "正在安装 git..." "$YELLOW"
    if [ -x "$(command -v apt-get)" ]; then
        sudo apt-get update && sudo apt-get install -y git
    elif [ -x "$(command -v yum)" ]; then
        sudo yum install -y git
    else
        print_message "❌ 请手动安装 git" "$RED"
        exit 1
    fi
fi

# 创建 dns 目录
DNS_DIR="$HOME/dns"
if [ ! -d "$DNS_DIR" ]; then
    print_message "创建目录: $DNS_DIR" "$YELLOW"
    mkdir -p "$DNS_DIR"
fi

# 进入 dns 目录
cd "$DNS_DIR"

# 克隆代码
print_message "正在下载代码..." "$YELLOW"
if [ -d ".git" ]; then
    print_message "更新已存在的代码..." "$YELLOW"
    git pull
else
    git clone https://github.com/rdone4425/cdn.git .
fi

if [ $? -eq 0 ]; then
    print_message "✅ 代码下载成功！" "$GREEN"
    print_message "代码位置: $DNS_DIR" "$GREEN"
    print_message "\n使用说明:" "$GREEN"
    print_message "1. 进入目录: ${YELLOW}cd $DNS_DIR${NC}"
    print_message "2. 安装DNS服务器: ${YELLOW}bash install.sh${NC}"
else
    print_message "❌ 下载失败，请检查网络连接" "$RED"
    exit 1
fi
