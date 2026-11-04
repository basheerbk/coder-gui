import {uid} from './ids';

const createBlock = (type, extras = {}) => ({
    uid: uid('blk'),
    type,
    cid: extras.cid == null ? null : extras.cid,
    params: extras.params ? Object.assign({}, extras.params) : {},
    children: extras.children ? extras.children.slice() : [],
    elseChildren: extras.elseChildren ? extras.elseChildren.slice() : []
});

const mapTree = (blocks, mapper) => (blocks || []).map(block => {
    const next = mapper(block);
    return Object.assign({}, next, {
        children: mapTree(next.children || [], mapper),
        elseChildren: mapTree(next.elseChildren || [], mapper)
    });
});

const filterTree = (blocks, predicate) => (blocks || []).reduce((acc, block) => {
    if (!predicate(block)) {
        return acc;
    }
    acc.push(Object.assign({}, block, {
        children: filterTree(block.children || [], predicate),
        elseChildren: filterTree(block.elseChildren || [], predicate)
    }));
    return acc;
}, []);

const deleteBlockById = (blocks, blockId) => filterTree(blocks, b => b.uid !== blockId);

const deleteBlocksByCid = (blocks, cid) => filterTree(blocks, b => b.cid !== cid);

const updateBlockParams = (blocks, blockId, params) => mapTree(blocks, block => {
    if (block.uid !== blockId) {
        return block;
    }
    return Object.assign({}, block, {
        params: Object.assign({}, block.params, params)
    });
});

const appendBlock = (blocks, newBlock, target) => {
    if (!target || !target.parentId) {
        return (blocks || []).concat([newBlock]);
    }
    const branch = target.branch === 'else' ? 'elseChildren' : 'children';
    let placed = false;
    const next = mapTree(blocks, block => {
        if (block.uid !== target.parentId) {
            return block;
        }
        placed = true;
        return Object.assign({}, block, {
            [branch]: (block[branch] || []).concat([newBlock])
        });
    });
    // The target was deleted (e.g. with its parent): never drop the new block.
    return placed ? next : next.concat([newBlock]);
};

export {
    createBlock,
    mapTree,
    filterTree,
    deleteBlockById,
    deleteBlocksByCid,
    updateBlockParams,
    appendBlock
};
