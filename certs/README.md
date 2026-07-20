# Russian CA Certificate

GigaChat использует сертификат НУЦ Минцифры. Node.js не доверяет ему по умолчанию.

## Установка

Выполни на сервере:

```bash
cd /home/tkit  # или куда деплоишь
curl -o certs/russian_trusted_root_ca.cer https://gu-st.ru/content/Other/doc/russian_trusted_root_ca_2022.cer
```

Файл `russian_trusted_root_ca.cer` должен лежать в папке `certs/` рядом с `package.json`.
