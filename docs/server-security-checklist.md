# 🔒 Checklist безопасности сервера 5.255.122.72

## 🚨 Критические проверки:

### **1. Исходящий трафик**
```bash
# Проверить активные соединения
netstat -tuln | grep :25    # SMTP
netstat -tuln | grep :587   # SMTP submission
netstat -tuln | grep :465   # SMTPS

# Мониторинг исходящих соединений
ss -tuln | grep -E ":(25|587|465|993|995)"
```

### **2. Почтовые сервисы**
```bash
# Проверить запущенные почтовые демоны
ps aux | grep -E "(postfix|sendmail|exim|qmail)"

# Проверить очереди писем
mailq
postqueue -p
```

### **3. Логи безопасности**
```bash
# Подозрительная активность
grep -i "spam\|relay\|bounce" /var/log/mail.log
grep -i "failed\|invalid" /var/log/auth.log
grep -i "attack\|intrusion" /var/log/syslog
```

### **4. Открытые порты**
```bash
# Сканирование портов
nmap -sS -O 5.255.122.72
nmap -sU -p 25,53,123 5.255.122.72
```

### **5. Веб-сервер**
```bash
# Проверить на вредоносный код
find /var/www -name "*.php" -exec grep -l "eval\|base64_decode\|shell_exec" {} \;
find /var/www -name "*.js" -exec grep -l "eval\|unescape" {} \;
```

## 🛡️ **Защитные меры:**

### **1. Firewall**
```bash
# Ограничить исходящий SMTP
iptables -A OUTPUT -p tcp --dport 25 -j DROP
iptables -A OUTPUT -p tcp --dport 587 -j DROP
```

### **2. Мониторинг**
```bash
# Установить fail2ban
apt-get install fail2ban

# Настроить мониторинг исходящих соединений
tcpdump -i any port 25 -w /tmp/smtp_traffic.pcap
```

### **3. Обновления**
```bash
# Обновить систему
apt-get update && apt-get upgrade
yum update

# Проверить уязвимости
lynis audit system
```
