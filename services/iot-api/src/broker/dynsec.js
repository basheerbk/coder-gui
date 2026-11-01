/**
 * Mosquitto dynamic-security command builders. Commands are sent as
 * {"commands":[...]} to $CONTROL/dynamic-security/v1 by the admin account.
 * Each device gets its own role, so it can only touch tb/<id>/...
 */
export const CONTROL_TOPIC = '$CONTROL/dynamic-security/v1';
export const RESPONSE_TOPIC = '$CONTROL/dynamic-security/v1/response';

export const roleName = id => `tbdev_${id}`;

export function deviceAcls (id) {
    const base = `tb/${id}`;
    const allow = (acltype, topic) => ({acltype, topic, priority: 0, allow: true});
    return [
        allow('publishClientSend', `${base}/telemetry`),
        allow('publishClientSend', `${base}/status`),
        allow('publishClientSend', `${base}/ack`),
        allow('publishClientSend', `${base}/alert`),
        allow('subscribePattern', `${base}/state/#`),
        allow('publishClientReceive', `${base}/state/#`),
        allow('unsubscribePattern', `${base}/state/#`)
    ];
}

export function createDeviceCommands (id, token, name) {
    return [
        {command: 'createRole', rolename: roleName(id), textname: `TinkerBit device ${id}`, acls: deviceAcls(id)},
        {
            command: 'createClient',
            username: id,
            password: token,
            clientid: id,
            textname: String(name || '').slice(0, 40),
            roles: [{rolename: roleName(id), priority: 0}]
        }
    ];
}

export const setPasswordCommands = (id, token) => [{command: 'setClientPassword', username: id, password: token}];
export const disableCommands = id => [{command: 'disableClient', username: id}];
export const enableCommands = id => [{command: 'enableClient', username: id}];
/** disableClient disconnects live sessions; enabling again lets the new token log in. */
export const kickCommands = id => [{command: 'disableClient', username: id}, {command: 'enableClient', username: id}];
export const removeCommands = id => [
    {command: 'deleteClient', username: id},
    {command: 'deleteRole', rolename: roleName(id)}
];

/** Errors that mean the desired end state already holds, so retries are idempotent. */
export function isBenignError (command, error) {
    const e = String(error || '').toLowerCase();
    if ((command === 'createRole' || command === 'createClient') && e.includes('already exists')) {
        return true;
    }
    if ((command === 'deleteClient' || command === 'deleteRole') && e.includes('not found')) {
        return true;
    }
    return false;
}
