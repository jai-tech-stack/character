import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          dragTooltip: "🖱 Drag to explore • 🎙 Tap to ask",
          loading: "Loading scene…",
          whatWeOffer: "What We Offer",
          offerText: "Branding, Digital Campaigns, 3D Storytelling — all infused with AI, to build sticky tribes™.",
          exploreWork: "Explore Our Work",
          askPlaceholder: "Ask me…",
          listening: "Listening…",
          thinking: "Thinking…",
          error: "Oops! Something went wrong."
        }
      },
      es: {
        translation: {
          dragTooltip: "🖱 Arrastra para explorar • 🎙 Toca para hablar",
          loading: "Cargando escena…",
          whatWeOffer: "Lo que ofrecemos",
          offerText: "Branding, campañas digitales, narración 3D — todo con IA, para crear marcas con sintonía™.",
          exploreWork: "Explorar trabajo",
          askPlaceholder: "Pregúntame…",
          listening: "Escuchando…",
          thinking: "Pensando…",
          error: "¡Vaya! Algo salió mal."
        }
      }
      // Add zh, fr, ar if needed
    }
  });

export default i18n;
