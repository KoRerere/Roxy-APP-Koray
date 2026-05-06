## 部署文档

本文档以 Ubuntu 22.04 / 24.04 为例。

### 安装 Docker

```bash
curl -sSL https://get.docker.com/ | CHANNEL=stable bash
```

```bash
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### 安装 PNPM 和 NodeJS
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

```bash
source ~/.bashrc
```

```bash
pnpm env use --global lts
```

```bash
pnpm add pm2 --global
```

### 安装 OpenResty

如果机器上已经装过 Nginx，先停掉：

```bash
sudo systemctl disable nginx
sudo systemctl stop nginx
```

```bash
sudo apt-get update
sudo apt-get -y install --no-install-recommends wget gnupg ca-certificates lsb-release
```

```bash
wget -O - https://openresty.org/package/pubkey.gpg | sudo gpg --dearmor -o /usr/share/keyrings/openresty.gpg
```

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/openresty.gpg] http://openresty.org/package/ubuntu $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/openresty.list > /dev/null
```

```bash
sudo apt-get update
sudo apt-get -y install openresty
```

```bash
sudo systemctl enable openresty
sudo systemctl restart openresty
```

```bash
openresty -v
```

拷贝项目配置并重载：

```bash
sudo cp /var/github/roxy-browser/apps/cloud-browser-gateway/build/nginx.conf /usr/local/openresty/nginx/conf/nginx.conf
sudo /usr/local/openresty/bin/openresty -t
sudo systemctl reload openresty
```

### 安装 Redis

Redis 默认使用本机 `127.0.0.1:6379`，不需要设置密码。

```bash
sudo apt-get update
sudo apt-get -y install redis-server
```

```bash
sudo systemctl enable redis-server
sudo systemctl restart redis-server
```

```bash
redis-cli ping
```

### 安装完成后的快速检查

```bash
openresty -v
redis-cli ping
node -v
pnpm -v
docker --version
```

如果这几项都正常，再继续部署 `cloud-browser-gateway` 本体和前端静态资源。
