import React from 'react';

/** The dashboard code (charts, the grid editor) only downloads once the IoT page shows a board. */
export default React.lazy(() => import(/* webpackChunkName: "studio-iot" */ './DeviceDashboard.jsx'));
