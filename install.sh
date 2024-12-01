#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_message "❌ $1 未安装，正在安装..." "$YELLOW"
        if [ -x "$(command -v apt-get)" ]; then
            sudo apt-get update && sudo apt-get install -y $1
        elif [ -x "$(command -v yum)" ]; then
            sudo yum install -y $1
        elif [ -x "$(command -v dnf)" ]; then
            sudo dnf install -y $1
        else
            print_message "❌ 无法安装 $1，请手动安装" "$RED"
            exit 1
        fi
    fi
}

# 检查必要的命令
print_message "正在检查必要的命令..." "$YELLOW"
check_command "git"
check_command "node"
check_command "npm"

# 创建工作目录
INSTALL_DIR="/opt/dns-server"
if [ ! -d "$INSTALL_DIR" ]; then
    print_message "创建安装目录: $INSTALL_DIR" "$YELLOW"
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown $(whoami):$(whoami) "$INSTALL_DIR"
fi

# 克隆代码
print_message "正在克隆代码..." "$YELLOW"
git clone https://github.com/rdone4425/cdn.git "$INSTALL_DIR/temp"
if [ $? -ne 0 ]; then
    print_message "❌ 克隆代码失败" "$RED"
    exit 1
fi

# 移动文件
cd "$INSTALL_DIR"
cp -r temp/worker/* .
rm -rf temp

# 创建必要的目录
print_message "创建必要的目录..." "$YELLOW"
mkdir -p cache logs cert

# 安装依赖
print_message "安装依赖..." "$YELLOW"
npm install

# 生成自签名证书
print_message "生成自签名证书..." "$YELLOW"
openssl req -x509 -newkey rsa:2048 -keyout cert/server.key -out cert/server.crt -days 365 -nodes -subj "/CN=dns-server"

# 设置权限
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# 创建系统服务
print_message "创建系统服务..." "$YELLOW"
cat << EOF | sudo tee /etc/systemd/system/dns-server.service
[Unit]
Description=DNS Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd配置
sudo systemctl daemon-reload

# 启动服务
print_message "启动服务..." "$YELLOW"
sudo systemctl enable dns-server
sudo systemctl start dns-server

# 检查服务状态
sleep 2
if systemctl is-active --quiet dns-server; then
    print_message "✅ DNS服务器安装成功！" "$GREEN"
    print_message "服务状态: $(systemctl is-active dns-server)" "$GREEN"
    print_message "监控面板: http://localhost:3000" "$GREEN"
    print_message "DNS服务端口: 53" "$GREEN"
else
    print_message "❌ 服务启动失败，请检查日志: journalctl -u dns-server" "$RED"
fi

# 打印使用说明
cat << EOF

${GREEN}=== DNS服务器使用说明 ===${NC}
1. 服务管理:
   - 启动: ${YELLOW}sudo systemctl start dns-server${NC}
   - 停止: ${YELLOW}sudo systemctl stop dns-server${NC}
   - 重启: ${YELLOW}sudo systemctl restart dns-server${NC}
   - 状态: ${YELLOW}sudo systemctl status dns-server${NC}

2. 查看日志:
   - 服务日志: ${YELLOW}journalctl -u dns-server${NC}
   - 应用日志: ${YELLOW}tail -f $INSTALL_DIR/logs/dns-server.log${NC}

3. 配置文件:
   - 主配置: ${YELLOW}$INSTALL_DIR/config.yml${NC}

4. 监控面板:
   - 地址: ${YELLOW}http://localhost:3000${NC}

5. 测试DNS服务器:
   ${YELLOW}dig @localhost www.google.com${NC}
   或
   ${YELLOW}nslookup www.google.com localhost${NC}

${GREEN}如果需要将此DNS服务器设为系统DNS，请修改 /etc/resolv.conf${NC}
EOF 