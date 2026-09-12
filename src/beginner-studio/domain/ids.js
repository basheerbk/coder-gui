let counter = 0;

const uid = (prefix = 'id') => {
    counter += 1;
    return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
};

export {uid};
