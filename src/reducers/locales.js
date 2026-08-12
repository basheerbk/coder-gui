import {addLocaleData} from 'react-intl';

import {localeData, isRtl} from 'openblock-l10n';
import editorMessages from 'openblock-l10n/locales/editor-msgs';
import arduinoUnoMessages from '../lib/device-msgs-arduino-uno.json';

addLocaleData(localeData);

const mergeDeviceMessages = messagesByLocale => {
    const merged = {};
    Object.keys(messagesByLocale).forEach(locale => {
        merged[locale] = Object.assign({}, messagesByLocale[locale], arduinoUnoMessages);
    });
    return merged;
};

const UPDATE_LOCALES = 'scratch-gui/locales/UPDATE_LOCALES';
const SELECT_LOCALE = 'scratch-gui/locales/SELECT_LOCALE';

const messagesByLocaleWithDevices = mergeDeviceMessages(editorMessages);

const initialState = {
    isRtl: false,
    locale: 'en',
    messagesByLocale: messagesByLocaleWithDevices,
    messages: messagesByLocaleWithDevices.en
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SELECT_LOCALE:
        return Object.assign({}, state, {
            isRtl: isRtl(action.locale),
            locale: action.locale,
            messagesByLocale: state.messagesByLocale,
            messages: state.messagesByLocale[action.locale]
        });
    case UPDATE_LOCALES:
        return Object.assign({}, state, {
            isRtl: state.isRtl,
            locale: state.locale,
            messagesByLocale: mergeDeviceMessages(action.messagesByLocale),
            messages: mergeDeviceMessages(action.messagesByLocale)[state.locale]
        });
    default:
        return state;
    }
};

const selectLocale = function (locale) {
    return {
        type: SELECT_LOCALE,
        locale: locale
    };
};

const setLocales = function (localesMessages) {
    return {
        type: UPDATE_LOCALES,
        messagesByLocale: localesMessages
    };
};
const initLocale = function (currentState, locale) {
    if (currentState.messagesByLocale.hasOwnProperty(locale)) {
        return Object.assign(
            {},
            currentState,
            {
                isRtl: isRtl(locale),
                locale: locale,
                messagesByLocale: currentState.messagesByLocale,
                messages: currentState.messagesByLocale[locale]
            }
        );
    }
    // don't change locale if it's not in the current messages
    return currentState;
};
export {
    reducer as default,
    initialState as localesInitialState,
    initLocale,
    selectLocale,
    setLocales
};
