#!/bin/bash
echo "========================================="
echo "       账号管家 Web 服务启动脚本"
echo "========================================="
echo ""
echo "[1] 启动本地开发服务 (热更新，适合边看边改)"
echo "[2] 构建并启动生产服务 (高性能，适合部署使用)"
echo ""
read -p "请选择你要启动的模式 (输入 1 或 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "正在启动开发服务器 (监听在 http://localhost:3000)..."
    npm run dev
elif [ "$choice" = "2" ]; then
    echo ""
    if [ -z "$INITIAL_ADMIN_USERNAME" ] || [ -z "$INITIAL_ADMIN_PASSWORD" ]; then
        echo "生产启动需要设置 INITIAL_ADMIN_USERNAME 和 INITIAL_ADMIN_PASSWORD。"
        exit 1
    fi
    if [ "$AUTH_COOKIE_SECURE" != "false" ]; then
        echo "局域网 HTTP 部署需要设置 AUTH_COOKIE_SECURE=false。"
        exit 1
    fi
    echo "正在构建项目，这可能需要几十秒的时间..."
    if ! npm run build; then
        echo "构建失败，未启动生产服务。"
        exit 1
    fi
    echo ""
    echo "构建完毕，正在启动生产服务器 (局域网访问 http://服务器局域网IP:3000)..."
    npm start
else
    echo "输入无效，脚本退出"
    exit 1
fi
