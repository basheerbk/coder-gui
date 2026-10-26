// Fill these in before launch. Placeholder values (still wrapped in {{ }}) are hidden on the page.
const SITE_CONFIG = {
    // {{SHIP_DATE}}
    shipDate: 'December 2026',
    contactEmail: 'hello@tinkerbit.io',
    social: [
        {label: 'LinkedIn', url: 'https://www.linkedin.com/company/tinker-bit/'},
        {label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61595876941022'},
        {label: 'Instagram', url: '{{INSTAGRAM_URL}}'},
        {label: 'YouTube', url: '{{YOUTUBE_URL}}'}
    ]
};

const isRealUrl = value => /^https?:\/\//.test(value || '');

export {SITE_CONFIG, isRealUrl};
