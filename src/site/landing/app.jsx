import React from 'react';

import {SiteFooter, SiteHeader} from './chrome.jsx';
import About from './sections/About.jsx';
import FactStrip from './sections/FactStrip.jsx';
import FinalCta from './sections/FinalCta.jsx';
import Hero from './sections/Hero.jsx';
import HowItWorks from './sections/HowItWorks.jsx';
import Makerspaces from './sections/Makerspaces.jsx';
import RoomToGrow from './sections/RoomToGrow.jsx';
import SpecSheet from './sections/SpecSheet.jsx';

import '../tokens.css';
import '../site.css';
import './landing.css';

const App = () => (
    <React.Fragment>
        <a
            className="sr-only tb-skip"
            href="#main"
        >Skip to content</a>
        <SiteHeader onHome />
        <main id="main">
            <Hero />
            <FactStrip />
            <HowItWorks />
            <RoomToGrow />
            <SpecSheet />
            <Makerspaces />
            <About />
            <FinalCta />
        </main>
        <SiteFooter onHome />
    </React.Fragment>
);

export default App;
