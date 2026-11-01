import {CONTROL_KEYS, READING_KEY_RE} from './format';

/** What each widget can show. `needs` is the kind of data it binds to. */
const TYPES = [
    {id: 'value', label: 'Number', needs: 'reading', blurb: 'The latest reading as a big number'},
    {id: 'gauge', label: 'Gauge', needs: 'reading', blurb: 'A dial between a minimum and a maximum'},
    {id: 'chart', label: 'Chart', needs: 'reading', blurb: 'The reading over time'},
    {id: 'switch', label: 'Switch', needs: 'switch', blurb: 'Turn something on or off from here'},
    {id: 'slider', label: 'Slider', needs: 'slider', blurb: 'Set a value from 0 to 100'},
    {id: 'status', label: 'Board status', needs: null, blurb: 'Online, signal and last seen'},
    {id: 'alerts', label: 'Alerts', needs: null, blurb: 'The latest alerts for this board'}
];

/** Ways to look at one reading; switching between them keeps the same data. */
const READING_LOOKS = ['value', 'gauge', 'chart'];

const MAX_WIDGETS = 24;

const typeSpec = id => TYPES.find(t => t.id === id) || TYPES[0];

const keysFor = (needs, readingKeys) => {
    if (needs === 'reading') {
        return readingKeys;
    }
    if (needs) {
        return Object.keys(CONTROL_KEYS).filter(k => CONTROL_KEYS[k] === needs);
    }
    return [];
};

/** Mirror of the server's checks so problems show before Save. */
const layoutProblem = layout => {
    for (const w of layout) {
        const spec = TYPES.find(t => t.id === w.type);
        if (!spec) {
            return 'Unknown widget type';
        }
        if (spec.needs === 'reading' && !READING_KEY_RE.test(w.key || '')) {
            return `“${w.title || spec.label}” needs a reading to show`;
        }
        const o = w.options || {};
        if (Number.isFinite(o.min) && Number.isFinite(o.max) && o.min >= o.max) {
            return `“${w.title || spec.label}”: Min must be below Max`;
        }
    }
    return null;
};

export {MAX_WIDGETS, READING_LOOKS, TYPES, keysFor, layoutProblem, typeSpec};
