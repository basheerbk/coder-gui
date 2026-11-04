import {TEMPLATES} from '../../../src/beginner-studio/domain/templates';

const JARGON = /HC-SR04|DHT11|MQ-2|L293D|OLED|RC522|HW-605|\bBLE\b|4-ch|\bMD\b|crosses limit/;

describe('project library', () => {
    test('every project name is unique', () => {
        const seen = {};
        const dupes = TEMPLATES.map(t => t.name).filter(name => {
            const dupe = Boolean(seen[name]);
            seen[name] = true;
            return dupe;
        });
        expect(dupes).toEqual([]);
    });

    test('no two-part project repeats the same pair of parts', () => {
        const seen = {};
        const dupes = [];
        TEMPLATES.filter(t => t.connections.length === 2 && !t.cloud).forEach(t => {
            const key = t.connections.map(c => c.moduleId).sort()
                .join('+');
            const withoutIds = (k, v) => {
                if (k === 'uid' || k === 'cid') {
                    return;
                }
                return v;
            };
            const pattern = JSON.stringify(t.program, withoutIds);
            if (seen[key] && seen[key] === pattern) {
                dupes.push(`${t.id} repeats ${key}`);
            }
            seen[key] = pattern;
        });
        expect(dupes).toEqual([]);
    });

    test('names and descriptions avoid part numbers and wiring jargon', () => {
        const hits = TEMPLATES.filter(t => JARGON.test(t.name) || JARGON.test(t.description))
            .map(t => `${t.id}: ${t.name} / ${t.description}`);
        expect(hits).toEqual([]);
    });
});
