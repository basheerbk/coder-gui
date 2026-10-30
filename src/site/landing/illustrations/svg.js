import React from 'react';

const PURPLE = 'var(--tb-purple)';
const INK = 'var(--tb-ink)';
const GOLD = 'var(--tb-gold)';
const LILAC = 'var(--tb-lilac)';
const GRID_BG = 'var(--tb-grid-bg)';
const GRID_LINE = 'var(--tb-grid-line)';
const LINE_SOFT = 'var(--tb-line-soft)';
const BODY = 'var(--tb-body)';
const ON_DARK = 'var(--tb-on-dark)';

// SVG presentation attributes don't resolve var(), so token colours move into the style prop.
const COLOR_ATTRS = ['fill', 'stroke', 'stopColor', 'floodColor', 'color'];

const isToken = value => typeof value === 'string' && value.indexOf('var(') === 0;

const toElement = (node, key) => {
    if (typeof node === 'string') {
        return node;
    }
    const [tag, attrs, ...children] = node;
    const props = {key};
    const style = Object.assign({}, attrs.style);
    Object.keys(attrs).forEach(name => {
        const value = attrs[name];
        if (name === 'style') {
            return;
        }
        if (COLOR_ATTRS.indexOf(name) !== -1 && isToken(value)) {
            style[name] = value;
        } else {
            props[name] = value;
        }
    });
    if (Object.keys(style).length) {
        props.style = style;
    }
    return React.createElement(tag, props, ...children.map(toElement));
};

/**
 * Build a static illustration component from a nested [tag, attrs, ...children] tree.
 * @param {Array} tree root ['svg', attrs, ...children] node with camelCase React attribute names.
 * @returns {Function} component that renders the illustration.
 */
const svgArt = tree => {
    const element = toElement(tree);
    return () => element;
};

export {BODY, GOLD, GRID_BG, GRID_LINE, INK, LILAC, LINE_SOFT, ON_DARK, PURPLE, svgArt};
