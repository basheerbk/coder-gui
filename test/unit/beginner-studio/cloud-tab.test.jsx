import {keyTitles} from '../../../src/beginner-studio/domain/cloudPanel';
import {moduleById} from '../../../src/beginner-studio/domain/modules';
import {templateById} from '../../../src/beginner-studio/domain/templates';
import {isAutoTitle} from '../../../src/iot/format';

const parking = templateById('cloud-parking');

describe('dashboard titles in the student\'s words', () => {
    test('reading keys become part names, controls the Dashboard block names', () => {
        const ultra = parking.connections.map(c => moduleById(c.moduleId)).find(m => m && m.valueName === 'distance');
        const titleOf = keyTitles(parking.connections);
        expect(titleOf('distance')).toBe(ultra.name);
        expect(titleOf('switch1')).toBe('Dashboard switch 1');
        expect(titleOf('slider1')).toBe('Dashboard slider 1');
    });

    test('keys the project does not know have no title, including object keys', () => {
        const titleOf = keyTitles(parking.connections);
        expect(titleOf('soilMoisture')).toBeNull();
        expect(titleOf('toString')).toBeNull();
        expect(titleOf('__proto__')).toBeNull();
        expect(keyTitles([])('distance')).toBeNull();
    });

    test('humidity gets its own name next to the temperature', () => {
        const titleOf = keyTitles([{id: 'c1', moduleId: 'dht', portId: 'D13'}]);
        expect(titleOf('temperature')).toBe(moduleById('dht').name);
        expect(titleOf('humidity')).toBe(`${moduleById('dht').name} humidity`);
    });

    test('only titles nobody typed count as automatic', () => {
        expect(isAutoTitle({key: 'distance', title: 'distance'})).toBe(true);
        expect(isAutoTitle({key: 'distance', title: 'Distance'})).toBe(true);
        expect(isAutoTitle({key: 'distance', title: ''})).toBe(true);
        expect(isAutoTitle({key: 'distance'})).toBe(true);
        expect(isAutoTitle({key: 'switch1', title: 'switch 1'})).toBe(true);
        expect(isAutoTitle({key: 'switch1', title: 'Switch 1'})).toBe(true);
        expect(isAutoTitle({key: 'distance', title: 'Car park'})).toBe(false);
    });
});
