import qrcode from 'qrcode-generator';
import React, {useMemo} from 'react';

/** Black-on-white QR code (phones read it in dark mode too), drawn as SVG cells. */
const QrCode = ({text, size = 168, label}) => {
    const cells = useMemo(() => {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        let d = '';
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) {
                    d += `M${c} ${r}h1v1h-1z`;
                }
            }
        }
        return {count, d};
    }, [text]);
    const quiet = 4;
    const box = cells.count + (quiet * 2);
    return (
        <svg
            role="img"
            aria-label={label}
            width={size}
            height={size}
            viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
            shapeRendering="crispEdges"
            style={{background: '#fff', borderRadius: 10, display: 'block'}}
        >
            <path d={cells.d} fill="#000" />
        </svg>
    );
};

export default QrCode;
