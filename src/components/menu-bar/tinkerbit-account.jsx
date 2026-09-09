import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import classNames from 'classnames';

import {fetchAuthMe, logout} from '../../lib/auth-client';
import styles from './tinkerbit-account.css';

class TinkerBitAccount extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleLogout',
            'handleToggle'
        ]);
        this.state = {
            open: false,
            user: null,
            loaded: false
        };
    }
    componentDidMount () {
        fetchAuthMe().then(data => {
            if (data && data.authenticated && data.user) {
                this.setState({user: data.user, loaded: true});
            } else {
                this.setState({loaded: true});
            }
        });
    }
    handleToggle () {
        this.setState(state => ({open: !state.open}));
    }
    handleLogout () {
        logout();
    }
    render () {
        const {user, open, loaded} = this.state;
        if (!loaded || !user) {
            return null;
        }
        return (
            <div className={classNames(styles.wrap, this.props.className)}>
                <button
                    className={styles.trigger}
                    type="button"
                    onClick={this.handleToggle}
                >
                    {user.picture ? (
                        <img
                            alt=""
                            className={styles.avatar}
                            src={user.picture}
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <span className={styles.avatarFallback} aria-hidden="true">
                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </span>
                    )}
                    <span className={styles.name}>{user.name || user.email}</span>
                </button>
                {open ? (
                    <div className={styles.menu} role="menu">
                        <div className={styles.email}>{user.email}</div>
                        <button
                            className={styles.logout}
                            type="button"
                            role="menuitem"
                            onClick={this.handleLogout}
                        >
                            Sign out
                        </button>
                    </div>
                ) : null}
            </div>
        );
    }
}

TinkerBitAccount.propTypes = {
    className: PropTypes.string
};

export default TinkerBitAccount;
