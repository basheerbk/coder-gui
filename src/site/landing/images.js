/**
 * Landing page image slots.
 *
 * To swap in a real photo, replace the file in src/landing/media/ that has the same base name
 * (hero.png, hero.jpg or hero.jpeg all work). The build (scripts/build-site-assets.js) makes the
 * .webp and the .png fallback and caps the size, so no code changes are needed.
 * Every frame crops with object-fit: cover, so any aspect ratio fits; width/height below only
 * reserve space before the image loads.
 */
const IMAGES = {
    // Hero background, wide and cropped on the right. Real photo: the board with a few modules
    // plugged in on a desk. Keep the left third calm; the headline sits over it.
    hero: {
        src: '/static/landing/hero',
        width: 1024,
        height: 558,
        alt: 'A young maker coding a glowing TinkerBit robot on a laptop with colorful blocks'
    },
    // Gallery card 1 (square frame). Real photo: the nightlight build.
    galleryNightlight: {
        src: '/static/landing/gallery-nightlight',
        width: 1024,
        height: 682,
        alt: 'TinkerBit board with a glowing owl nightlight and warm maker desk props'
    },
    // Gallery card 2 (square frame). Real photo: the button + buzzer doorbell build.
    galleryDoorbell: {
        src: '/static/landing/gallery-doorbell',
        width: 1024,
        height: 682,
        alt: 'Child pressing a blue button module connected to a TinkerBit board and speaker'
    },
    // Gallery card 3 (square frame). Real photo: the rover build, ideally with the IDE open on
    // a laptop beside it.
    galleryBot: {
        src: '/static/landing/gallery-bot',
        width: 1024,
        height: 682,
        alt: 'TinkerBit desk rover with ultrasonic eyes beside a laptop showing block code'
    }
    // Link-preview card (WhatsApp, LinkedIn, X): src/landing/media/og-image.png, ideally
    // 1200x630. The build crops/resizes whatever is there to exactly 1200x630.
};

export default IMAGES;
