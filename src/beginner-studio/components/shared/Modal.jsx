import React from 'react';

import {useStudio} from '../../context/StudioContext.jsx';

const Modal = ({title, onClose, children, width = 720}) => {
    const {K} = useStudio();
    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                animation: 'tbFadeIn 0.18s ease',
                padding: 16
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: width,
                    maxHeight: '85vh',
                    overflow: 'auto',
                    background: K.panel,
                    border: `1px solid ${K.border}`,
                    borderRadius: 14,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
                    padding: 18
                }}
            >
                <div style={{display: 'flex', alignItems: 'center', marginBottom: 14}}>
                    <div style={{fontSize: 16, fontWeight: 700, color: K.text, flex: 1}}>{title}</div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: K.surface,
                            border: 'none',
                            color: K.sub,
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 12
                        }}
                    >
                        Close
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;
