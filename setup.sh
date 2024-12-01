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

# 检查是否是 root 用户
if [ "$EUID" -ne 0 ]; then 
    print_message "❌ 请使用 root 用户运行此脚本" "$RED"
    exit 1
fi

# 创建临时目录
print_message "创建临时目录..." "$YELLOW"
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# 下载代码
print_message "正在下载代码..." "$YELLOW"
git clone https://github.com/rdone4425/cdn.git .

if [ $? -eq 0 ]; then
    # 创建 dns 目录并复制文件
    print_message "创建 /root/dns 目录..." "$YELLOW"
    mkdir -p /root/dns
    cp -r worker/* /root/dns/
    cd /root/dns
    
    # 清理临时目录
    rm -rf "$TEMP_DIR"
    
    print_message "✅ 代码下载成功！" "$GREEN"
    print_message "代码位置: $(pwd)" "$GREEN"
    
    # 创建必要的目录
    mkdir -p cache logs cert
    
    # 设置权限
    chmod -R 755 .
    chmod 644 *.json *.yml 2>/dev/null
    chown -R root:root .
    
    # 显示目录结构
    print_message "\n目录结构:" "$GREEN"
    tree -L 2 2>/dev/null || ls -la
else
    print_message "❌ 下载失败，请检查网络连接" "$RED"
    cd /root
    rm -rf "$TEMP_DIR"
    exit 1
fi 
