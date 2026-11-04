import React from 'react';
import ReactDOM from 'react-dom';
import {act} from 'react-dom/test-utils';

import {useStudio} from '../../../src/beginner-studio/context/StudioContext.jsx';
import ComponentShelf from '../../../src/beginner-studio/components/build/ComponentShelf.jsx';
import PartIcon, {partIconUri} from '../../../src/beginner-studio/components/shared/PartIcon.jsx';
import {MODULES} from '../../../src/beginner-studio/domain/modules';

jest.mock('../../../src/beginner-studio/context/StudioContext.jsx', () => ({useStudio: jest.fn()}));

const K = new Proxy({}, {get: () => '#888888'});

const render = element => {
    const host = document.createElement('div');
    act(() => {
        ReactDOM.render(element, host);
    });
    return host;
};

const shelf = (connections, extra) => {
    useStudio.mockReturnValue(Object.assign({
        categoryFilter: 'all',
        setCategoryFilter: jest.fn(),
        selectedModule: null,
        selectModule: jest.fn(),
        connections,
        K
    }, extra));
    return render(<ComponentShelf />);
};

const tileImg = (host, name) => {
    const tile = Array.from(host.querySelectorAll('button'))
        .find(b => (b.getAttribute('aria-label') || '').indexOf(`${name}:`) === 0);
    return tile && tile.querySelector('img');
};

describe('part icons', () => {
    test('every shelf part has a colour icon', () => {
        expect(MODULES.filter(m => !partIconUri(m.id)).map(m => m.id)).toEqual([]);
    });

    test('icons are SVG data URIs, built once per part', () => {
        const uri = partIconUri('btn');
        expect(uri.indexOf('data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(0);
        expect(partIconUri('btn')).toBe(uri);
    });

    test('unknown parts and inherited object keys fall back to the line glyph', () => {
        expect(partIconUri('toString')).toBeNull();
        const host = render(<PartIcon id="not-a-part" color="#123456" size={36} />);
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('svg')).not.toBeNull();
    });

    test('a picture that fails to load is swapped for the line glyph', () => {
        const host = render(<PartIcon id="led" color="#123456" />);
        act(() => {
            host.querySelector('img').dispatchEvent(new Event('error'));
        });
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('svg')).not.toBeNull();
    });

    test('the picture is decorative and cannot be dragged off the tile', () => {
        const img = render(<PartIcon id="led" />).querySelector('img');
        expect(img.getAttribute('alt')).toBe('');
        expect(img.getAttribute('aria-hidden')).toBe('true');
        expect(img.getAttribute('draggable')).toBe('false');
        expect(img.style.pointerEvents).toBe('none');
    });
});

describe('shelf tiles', () => {
    test('show the colour icon at full detail size', () => {
        const img = tileImg(shelf([]), 'LED');
        expect(img.getAttribute('width')).toBe('40');
        expect(img.style.filter).toBe('none');
    });

    test('parts that cannot be used right now are greyed out; parts on the board keep their colours', () => {
        const host = shelf([{id: 'c1', moduleId: 'cloud', portId: 'ONBOARD'}, {id: 'c2', moduleId: 'led', portId: 'D13'}]);
        expect(tileImg(host, 'Potentiometer').style.filter).toBe('grayscale(1)');
        expect(tileImg(host, 'Bluetooth (BLE)').style.filter).toBe('grayscale(1)');
        expect(tileImg(host, 'LED').style.filter).toBe('none');
        expect(tileImg(host, 'TinkerBit Cloud').style.filter).toBe('none');
    });
});
