# Personel Envanter & İzin Süreci Portalı

Kurumsal seviyede personel yönetim portalı. Excel dosyalarından veri okur, dashboard üzerinde görselleştirir.

## 🚀 Çalıştırma

```bash
cd /Users/gokturkkahriman/peder-proje
python3 -m http.server 8080
```

Tarayıcıda: **http://localhost:8080**

## 📂 Veri Dosyaları

`data/` klasöründe 4 Excel dosyası bulunmalı:

| Dosya | Açıklama |
|-------|----------|
| `inventory.xlsx` | İzni çıkmış personel envanteri |
| `process.xlsx` | Süreç takip çizelgesi |
| `leaves_2025_12.xlsx` | Aralık 2025 izin belgeleri |
| `departures_2025.xlsx` | 2025 işten ayrılanlar |

## 📋 Özellikler

- **Dashboard**: KPI kartları, kategori/rol dağılımı grafikleri
- **Personel Envanteri**: Arama, filtreleme, CSV export
- **İzin Süreci**: Durum takibi, gecikme uyarıları
- **Aylık İzin**: Dönem bazlı izin kullanımları
- **Ayrılanlar**: Ay bazlı kategorize ayrılma verileri
- **Veri Kalitesi**: Otomatik doğrulama kontrolleri

## 🔄 Veri Güncelleme

1. Yeni Excel'i `data/` klasörüne koyun
2. Sayfada "🔄 Yenile" butonuna tıklayın
