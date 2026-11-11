# chatledger

Bir WhatsApp veya Telegram sohbet dökümünü kendi bilgisayarınızda açın ve o sohbette olan her şeyi okuyun.

chatledger sizin bilgisayarınızda çalışır ve sohbeti tarayıcınızda gösterir. Mesajlarınız, fotoğraflarınız ve sesli mesajlarınız hiçbir yere yüklenmez. Uygulama hiçbir ağ isteği yapmaz; yapmaya kalkarsa içerik güvenlik politikası bunu engeller.

[English](README.md)

![Arama sonuçları işaretlenmiş bir sohbet](docs/screenshots/search.png)

## Neler yapar

- WhatsApp'ın dışa aktardığı `.zip` veya `.txt` dosyasını ya da dosyaların bulunduğu bir klasörü açar. Android dökümleri tam olarak desteklenir; iPhone dökümleri şimdilik deneyseldir (bkz. *Bilinen sınırlar*).
- Telegram Desktop'tan JSON veya HTML olarak dışa aktarılan Telegram sohbetlerini de yanıtları, iletilen mesajları, tepkileri ve gizli (spoiler) metinleriyle açar. Bu da şimdilik deneyseldir.
- Sohbeti hatırladığınız gibi gösterir: fotoğraflar, videolar, çıkartmalar, sesli mesajlar, belgeler, anketler ve grup olayları. Yüz binlerce mesajlık sohbetlerde de akıcı kalır.
- Mesajları hızlı bulur. Büyük/küçük harf ve Türkçe karakterler fark etmez, `ogretmen` yazınca `Öğretmen` de bulunur. Tam bir ifadeyi tırnak içinde arayabilir, kişiye, medyaya ya da bağlantılara göre süzebilirsiniz.
- Biçimlendirmeyi WhatsApp'taki gibi gösterir: *kalın*, _italik_, ~üstü çizili~, `kod`, @bahsetmeler ve büyük emojiler.
- İstediğiniz tarihe, ilk ya da son mesaja veya sohbetin yanındaki zaman çizelgesi boyunca götürür. Kaldığınız yerden açılır ve her mesajın kendi bağlantısı vardır.
- Mesajları yıldızlamanızı, kopyalamanızı ve yıldızlarınızı dışa ya da içe aktarmanızı sağlar.
- Aynı sohbetin birden fazla dökümünü tek bir zaman çizelgesinde birleştirir. WhatsApp yalnızca en son mesajları dışa aktardığı için uzun sohbetler çoğu zaman parça parça gelir; birden fazla dökümde olan mesajlar en dolu hâliyle bir kez tutulur.
- Sohbetin tamamını, bir tarih aralığını ya da yıldızlı mesajları yazdırır veya PDF olarak kaydeder.
- Sesli mesajları dalga görüntüsüyle 1×, 1,5× ya da 2× hızda oynatır, paylaşılan kişi kartlarını gösterir, PDF ve Word belgelerini önizler.
- Grubun geçmişini gösterir: kimin kurduğunu, adının nasıl değiştiğini, kimlerin hâlâ grupta olduğunu ve geçmiş yıllarda bugün neler konuşulduğunu.
- Sohbetteki bütün fotoğraf ve videoları, dosyaları ve bağlantıları tek yerde toplar; fotoğraflar tam ekran açılır.
- En çok kimin yazdığını ve sohbetin en hareketli olduğu saatleri sayar. Aylara göre mesajları, sevilen emojileri, en uzun sessizliği ve daha fazlasını gösterir.
- Açtığınız sohbetleri hatırlar, yeniden başlattığınızda da yerinde olurlar. Bunu kapatabilir, kayıtlı herhangi bir sohbeti kaldırabilirsiniz.
- Arayüzü İngilizce, Almanca, İspanyolca, Fransızca, İtalyanca, Portekizce ve Türkçedir; bu dillerden herhangi birine ayarlı telefonların dökümlerini okur. Grup olayları, telefonun dili ne olursa olsun sizin okuduğunuz dilde yazılır.
- Açık ve koyu tema, üç yazı boyutu ve klavye kısayolları vardır (`?` tuşuna basın).

| Galeri | İstatistikler |
| --- | --- |
| ![Bir sohbetin fotoğrafları, aylara göre](docs/screenshots/gallery.png) | ![En çok kim ve ne zaman yazmış](docs/screenshots/stats.png) |

Görsellerdeki sohbet, testlerle birlikte gelen uydurma bir sohbettir.

## Başlarken

### 1. Sohbeti dışa aktarın

- **Android:** sohbeti açın, ⋮ › Diğer › Sohbeti dışa aktar'a dokunun ve **Medyayı dahil et**'i seçin.
- **iPhone:** sohbeti açın, üstteki ada dokunun, ardından **Sohbeti Dışa Aktar › Medyayı Ekle**'yi seçin.

Dosyayı bilgisayarınıza kaydedin.

**Telegram:** sohbetler yalnızca [Telegram Desktop](https://desktop.telegram.org)'tan dışa aktarılabilir. Sohbeti açın, ⋮ › **Sohbet geçmişini dışa aktar**'a tıklayın, istediğiniz medyayı ve iki biçimden birini seçin. Telegram bir klasör oluşturur; bu klasörü chatledger'da açın ya da sıkıştırıp zip dosyasını açın.

### 2. chatledger'ı indirin

Sürümler sayfasından bilgisayarınıza uygun dosyayı seçin. Hiçbir şey kurmanız gerekmez.

- **Windows:** `chatledger-x.y.z-windows-x64.zip`
- **Linux:** `chatledger-x.y.z-linux-x64.zip`

Dosyayı istediğiniz bir yere çıkarın.

### 3. Başlatın

Windows'ta `chatledger.exe`, Linux'ta `chatledger` dosyasına çift tıklayın. Tarayıcınız `http://127.0.0.1:5170` adresinde açılır.

- Program ücretli bir sertifikayla imzalanmadığı için Windows bilgisayarınızı koruduğunu söyleyebilir. **Ek bilgi › Yine de çalıştır**'ı seçin.
- Linux'ta çift tıklayınca dosya bir metin düzenleyicide açılırsa, sağ tıklayıp *Çalıştır*'ı seçin ya da bir terminalde `./chatledger` komutunu çalıştırın.

chatledger, sekmelerinden biri açık olduğu sürece arka planda çalışır; son sekmeyi kapattıktan birkaç dakika sonra kendiliğinden durur.

#### Node.js zaten kuruluysa

[Node.js](https://nodejs.org) 22 veya daha yenisi kuruluysa, çok daha küçük olan `chatledger-x.y.z.zip` her sistemde çalışır. Dosyayı çıkarın, ardından Windows'ta `chatledger.cmd` dosyasına çift tıklayın ya da Linux'ta `./chatledger.sh` komutunu çalıştırın. chatledger'ı kullandığınız sürece açılan pencereyi açık tutun; pencereyi kapatınca uygulama durur.

chatledger, Firefox'un ve Chrome, Edge gibi Chromium tabanlı tarayıcıların güncel sürümlerinde test edilmektedir.

## Bilinen sınırlar

- **iPhone dökümleri deneyseldir.** chatledger iPhone'un dışa aktarma biçimine göre yazıldı, ancak henüz pek çok gerçek iPhone dökümüyle denenmedi. Biri açılmazsa ya da yanlış görünürse lütfen bildirin (aşağıya bakın).
- Almanca, İspanyolca, Fransızca, İtalyanca veya Portekizce ayarlı telefonlardan gelen dökümler, WhatsApp'ın bu dillerdeki ifadelerine göre okunur ancak henüz pek çok gerçek dökümle denenmedi. Bir grup olayı sizin diliniz yerine telefonun dilinde görünürse ya da bir ek tanınmazsa lütfen o satırı (adları değiştirerek) bildirin.
- Başka dillere ayarlı telefonlardan gelen grup olayları çevrilmeden, WhatsApp'ın yazdığı gibi gösterilir. Mesajlar, tarihler ve medya her dilde çalışır.
- **Telegram desteği deneyseldir.** Gerçek kanal dökümleriyle denendi, ancak grup ve birebir sohbetlerle henüz denenmedi. HTML dökümleri hangi mesajların düzenlendiğini ve sistem mesajlarının tam saatini yazmaz; JSON dökümleri yazar. HTML dökümlerinde "Ada, Bora'yı ekledi" gibi sistem mesajları Telegram'ın İngilizce ifadelerinden okunur; tanınmayanlar yazıldığı gibi gösterilir. Hareketli çıkartmalar sabit resimleriyle görünür. Bütün bir hesabın dökümü açılmaz; sohbetleri tek tek dışa aktarın.

## Sohbetleriniz nerede saklanır

Hatırlama açıkken açtığınız döküm, tarayıcınızın chatledger adresine ait özel depolama alanına kopyalanır. Bu kopya yalnızca bu bilgisayarda, bu tarayıcıda kalır. Bir sohbeti kayıtlı listeden **Kaldır** ile silebilirsiniz. Tarayıcıda `127.0.0.1:5170` için site verilerini temizlemek hepsini siler.

Bilgisayarı başkalarıyla paylaşıyorsanız başlangıç ekranındaki **Açtığım sohbetleri bu bilgisayarda hatırla** seçeneğini kapatın ya da **Kayıtlı sohbetleri parolayla koru**'yu seçin. Kayıtlı sohbetler o zaman adlarıyla birlikte şifrelenir ve parola olmadan kimse okuyamaz. Parolayı iyi saklayın: kaybolursa kayıtlı sohbetler açılamaz, yalnızca kaldırılabilir.

## Kaynak koddan çalıştırma

```sh
git clone https://github.com/abel0x/chatledger.git
cd chatledger
npm install
npm start
```

| Komut | Ne yapar |
| --- | --- |
| `npm start` | Gerekirse derler ve uygulamayı `http://127.0.0.1:5170` adresinde açar |
| `npm run dev` | Değişiklikleri anında yansıtan geliştirme sunucusu |
| `npm test` | Testleri çalıştırır |
| `npm run test:e2e` | Tarayıcı testlerini Chromium ve Firefox'ta çalıştırır |
| `npm run screenshots` | README görsellerini demo sohbetten çeker |
| `npm run check` | Kodun tiplerini denetler |
| `npm run release` | Node.js ile çalışan zip'i ve bu sistem için tek dosyalık programı hazırlar (Node.js 26 gerekir) |

Kod üç katmandan oluşur. `src/core` dökümleri okur ve ekrandan habersizdir. `src/loader` arşivleri bir worker içinde açar. `src/ui` ise Svelte arayüzüdür. Testler yalnızca uydurma sohbetler kullanır; tarayıcı testlerinin ve ekran görüntülerinin kullandığı demo dökümü `tests/e2e/demo.ts` üretir. Gerçek dökümleri bir `coldstorage/` klasöründe tutarsanız, birkaç ek test sizin bilgisayarınızda onlarla da çalışır. Bu klasör git tarafından yok sayılır.

## Sorun bildirme

Güvenlik sorunlarını herkese açık bir issue yerine [SECURITY.md](SECURITY.md) dosyasındaki yolla gizlice bildirin.

Bir döküm açılmıyorsa ya da bir şey yanlış görünüyorsa lütfen bir issue açıp anlatın. Telefonunuzun dilini ve Android mi iPhone mu olduğunu da yazın. Sohbetinizi eklemeyin. Yanlış okunan bir satır varsa, paylaşmadan önce içindeki adları ve metni değiştirin.

## WhatsApp veya Telegram ile bağlantısı yoktur

chatledger bağımsız bir projedir. WhatsApp, Meta ya da Telegram tarafından yapılmamış, onaylanmamış ve desteklenmemektedir. WhatsApp ve Telegram, sahiplerine ait ticari markalardır.

## Lisans

Telif hakkı © 2026 abel0x

chatledger özgür bir yazılımdır: Free Software Foundation tarafından yayımlanan GNU Genel Kamu Lisansı'nın 3. sürümü ya da (tercihinize göre) daha sonraki herhangi bir sürümü koşullarına uygun olarak yeniden dağıtabilir ve/veya değiştirebilirsiniz. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.
