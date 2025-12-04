// plugins/localized-infoplist.js
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const LOCALES = ["en", "tr", "ru", "el"];

const TRANSLATIONS = {
  en: {
    NSCameraUsageDescription: "We need camera access to scan QR codes.",
    NSLocationWhenInUseUsageDescription: "We use your location to show nearby restaurants.",
    NSUserNotificationsUsageDescription: "Notifications are required for reservation updates.",
    NSPhotoLibraryUsageDescription: "We need access to choose your profile photo.",
    NSPhotoLibraryAddUsageDescription: "We need permission to save your profile photo."
  },
  tr: {
    NSCameraUsageDescription: "QR kodlarını taramak için kamera erişimine ihtiyacımız var.",
    NSLocationWhenInUseUsageDescription: "Yakındaki restoranları gösterebilmek için konum bilginize ihtiyacımız var.",
    NSUserNotificationsUsageDescription: "Bildirimler, rezervasyon güncellemeleri için gereklidir.",
    NSPhotoLibraryUsageDescription: "Profil fotoğrafını seçebilmek için fotoğraf arşivine erişmemiz gerekiyor.",
    NSPhotoLibraryAddUsageDescription: "Profil fotoğrafını kaydedebilmek için izin gerekir."
  },
  ru: {
    NSCameraUsageDescription: "Нам нужен доступ к камере для сканирования QR-кодов.",
    NSLocationWhenInUseUsageDescription: "Мы используем вашу геолокацию для показа ближайших ресторанов.",
    NSUserNotificationsUsageDescription: "Уведомления необходимы для обновлений бронирования.",
    NSPhotoLibraryUsageDescription: "Нам нужен доступ к фотоархиву для выбора аватара.",
    NSPhotoLibraryAddUsageDescription: "Нам нужно разрешение для сохранения фотографии."
  },
  el: {
    NSCameraUsageDescription: "Χρειαζόμαστε πρόσβαση στην κάμερα για σάρωση QR κωδίκων.",
    NSLocationWhenInUseUsageDescription: "Χρησιμοποιούμε την τοποθεσία σας για να δείξουμε κοντινά εστιατόρια.",
    NSUserNotificationsUsageDescription: "Οι ειδοποιήσεις απαιτούνται για ενημερώσεις κρατήσεων.",
    NSPhotoLibraryUsageDescription: "Χρειαζόμαστε πρόσβαση για επιλογή φωτογραφίας προφίλ.",
    NSPhotoLibraryAddUsageDescription: "Χρειαζόμαστε άδεια για αποθήκευση της φωτογραφίας."
  }
};

function writeInfoPlistStrings(projectRoot) {
  const iosDir = path.join(projectRoot, "ios");
  if (!fs.existsSync(iosDir)) {
    // Managed EAS build'te bu klasör build sırasında oluşturuluyor;
    // plugin de o aşamada çalışacağı için burada normalde var olacak.
    return;
  }

  LOCALES.forEach((locale) => {
    const folder = path.join(iosDir, `${locale}.lproj`);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const file = path.join(folder, "InfoPlist.strings");
    const dict = TRANSLATIONS[locale];

    const content =
      Object.entries(dict)
        .map(([k, v]) => `"${k}" = "${v.replace(/"/g, '\\"')}";`)
        .join("\n") + "\n";

    fs.writeFileSync(file, content, "utf8");
  });
}

module.exports = function withLocalizedInfoPlist(config) {
  return withDangerousMod(config, ["ios", async (config) => {
    // Burada native iOS projesi oluşturulmuş oluyor
    writeInfoPlistStrings(config.modRequest.projectRoot);
    return config;
  }]);
};