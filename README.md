# Personel Envanter & İzin Süreci Portalı

Bu proje, Vanilla JS (ES Modules) kullanılarak geliştirilmiş, kurumsal kullanıma uygun modern bir web uygulamasıdır. Excel dosyalarından veriyi **otomatik okur**, dashboard üzerinde görselleştirir ve yönetim imkanı sağlar.

## 🚀 Özellikler

-   **Otomatik Veri Entegrasyonu**: `/data` klasöründeki Excel dosyalarını açılışta otomatik okur. Dosya yüklemeye gerek yoktur.
-   **Dashboard & KPI**: Anlık personel sayısı, süreç durumu ve dağılımlar.
-   **Detaylı Yönetim**: Tablo satırlarına tıklayarak detay penceresini (Drawer) açabilir, durum/not güncellemesi yapabilirsiniz.
-   **Kalıcı Düzenlemeler**: Yaptığınız değişiklikler tarayıcı hafızasında (LocalStorage) saklanır. Sayfayı yenileseniz bile kaybolmaz.
-   **Raporlama**: Detaylı filtreleme ve CSV dışa aktarım seçenekleri.

## 🛠 Kurulum ve Çalıştırma

Güvenlik (CORS) nedeniyle proje bir yerel sunucu üzerinde çalışmalıdır.

1.  Terminali açın ve proje klasörüne gidin:
    ```bash
    cd /Users/gokturkkahriman/peder-proje
    ```

2.  Sunucuyu başlatın:
    ```bash
    python3 -m http.server 8080
    ```

3.  Tarayıcıda açın:
    👉 [http://localhost:8080](http://localhost:8080)

## 📂 Veri Güncelleme

Sistem verileri `data/` klasöründen okur:
-   **Envanter**: `data/inventory.xlsx`
-   **Süreç**: `data/process.xlsx`

**Veriyi güncellemek için:**
1.  Yeni Excel dosyanızın ismini `inventory.xlsx` veya `process.xlsx` yapın.
2.  `data/` klasöründeki eski dosyanın üzerine kaydedin.
3.  Uygulamada sağ üstteki **"🔄 Yenile"** butonuna basın.

## 📝 Kullanım İpuçları
-   **Düzenleme**: Listede bir isme tıklayın > Sağdan açılan panelde değişiklikleri yapın > Kaydet diyin.
-   **Sıfırlama**: Tüm el ile yapılan değişiklikleri silmek için üst menüdeki "🗑️ Sıfırla" butonunu kullanın.
-   **Veri Kalitesi**: Mükerrer kayıt veya eksik bilgi uyarılarını "Veri Kalitesi" sekmesinden takip edin.
# peder-personel
