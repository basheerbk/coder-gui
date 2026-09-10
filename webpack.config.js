const defaultsDeep = require('lodash.defaultsdeep');
var path = require('path');
var webpack = require('webpack');

// Plugins
var CopyWebpackPlugin = require('copy-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

// PostCss
var autoprefixer = require('autoprefixer');
var postcssVars = require('postcss-simple-vars');
var postcssImport = require('postcss-import');

const STATIC_PATH = process.env.STATIC_PATH || '/static';
const MONACO_DIR = path.resolve(__dirname, './node_modules/monaco-editor');
const LINK_PROXY_TARGET = process.env.COMPILE_PROXY_TARGET || 'http://13.217.19.72';
const linkProxy = {
    target: LINK_PROXY_TARGET,
    changeOrigin: true,
    secure: false
};

const SITE_DIR = path.resolve(__dirname, 'src/site');

const postCssPlugins = function () {
    return [
        postcssImport,
        postcssVars,
        autoprefixer
    ];
};

const base = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: 'cheap-module-source-map',
    devServer: {
        contentBase: [
            path.resolve(__dirname, 'build'),
            path.resolve(__dirname, 'test')
        ],
        host: '0.0.0.0',
        port: process.env.PORT || 8601,
        // Embedded browsers (e.g. Cursor Simple Browser) often hang on the HMR client.
        hot: false,
        injectClient: false,
        injectHot: false,
        historyApiFallback: {
            rewrites: [
                {from: /^\/ide\/?$/, to: '/ide.html'},
                {from: /^\/login\/?$/, to: '/login.html'}
            ]
        },
        proxy: {
            '/api/auth': {
                target: process.env.AUTH_PROXY_TARGET || 'http://127.0.0.1:3000',
                changeOrigin: true,
                secure: false
            },
            '/api/compile': Object.assign({}, linkProxy, {
                timeout: 180000,
                proxyTimeout: 180000
            }),
            '/devices': linkProxy,
            '/extensions': linkProxy
        }
    },
    output: {
        library: 'GUI',
        filename: '[name].js',
        chunkFilename: 'chunks/[name].js'
    },
    resolve: {
        symlinks: false
    },
    module: {
        rules: [{
            test: /\.jsx?$/,
            loader: 'babel-loader',
            include: [
                path.resolve(__dirname, 'src'),
                /node_modules[\\/]scratch-[^\\/]+[\\/]src/,
                /node_modules[\\/]pify/,
                /node_modules[\\/]@vernier[\\/]godirect/
            ],
            options: {
                // Explicitly disable babelrc so we don't catch various config
                // in much lower dependencies.
                babelrc: false,
                plugins: [
                    '@babel/plugin-syntax-dynamic-import',
                    '@babel/plugin-transform-async-to-generator',
                    '@babel/plugin-proposal-object-rest-spread',
                    ['react-intl', {
                        messagesDir: './translations/messages/'
                    }]],
                presets: ['@babel/preset-env', '@babel/preset-react']
            }
        },
        {
            test: /\.css$/,
            exclude: [MONACO_DIR, SITE_DIR],
            use: [{
                loader: 'style-loader'
            }, {
                loader: 'css-loader',
                options: {
                    modules: true,
                    importLoaders: 1,
                    localIdentName: '[name]_[local]_[hash:base64:5]',
                    camelCase: true
                }
            }, {
                loader: 'postcss-loader',
                options: {
                    ident: 'postcss',
                    plugins: postCssPlugins
                }
            }]
        },
        {
            // Marketing / login pages use global class names (not CSS modules).
            test: /\.css$/,
            include: SITE_DIR,
            use: [{
                loader: 'style-loader'
            }, {
                loader: 'css-loader',
                options: {
                    modules: false,
                    importLoaders: 1
                }
            }, {
                loader: 'postcss-loader',
                options: {
                    ident: 'postcss-site',
                    plugins: postCssPlugins
                }
            }]
        },
        {
            test: /\.css$/,
            include: MONACO_DIR,
            use: ['style-loader', 'css-loader']
        }]
    },
    optimization: {
        minimizer: [
            new UglifyJsPlugin({
                include: /\.min\.js$/
            })
        ]
    },
    plugins: [
        new MonacoWebpackPlugin({
            languages: ['c', 'cpp', 'python', 'lua', 'javascript'],
            features: ['!gotoSymbol']
        })
    ]
};

if (!process.env.CI) {
    base.plugins.push(new webpack.ProgressPlugin());
}

module.exports = [
    // to run editor examples
    defaultsDeep({}, base, {
        entry: {
            'lib.min': ['react', 'react-dom'],
            'gui': './src/playground/index.jsx',
            'blocksonly': './src/playground/blocks-only.jsx',
            'compatibilitytesting': './src/playground/compatibility-testing.jsx',
            'player': './src/playground/player.jsx'
        },
        output: {
            path: path.resolve(__dirname, 'build'),
            filename: '[name].js'
        },
        module: {
            rules: base.module.rules.concat([
                {
                    test: /\.(svg|png|wav|gif|jpg|ttf)$/,
                    loader: 'file-loader',
                    options: {
                        outputPath: 'static/assets/'
                    }
                }
            ])
        },
        optimization: {
            // Keep shared app code in lib.min so HtmlWebpackPlugin script tags stay complete.
            // A separate auto-named shared chunk was missing from index.html and left the
            // page stuck on the HTML "Loading..." splash (React never mounted).
            splitChunks: {
                chunks: 'all',
                name: 'lib.min',
                cacheGroups: {
                    esptool: {
                        test: /[\\/]node_modules[\\/](esptool-js|pako|atob-lite|tslib)[\\/]/,
                        name: 'esptool',
                        chunks: 'all',
                        enforce: true,
                        priority: 30
                    }
                }
            },
            runtimeChunk: {
                name: 'lib.min'
            }
        },
        plugins: base.plugins.concat([
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': '"' + process.env.NODE_ENV + '"',
                'process.env.DEBUG': Boolean(process.env.DEBUG),
                'process.env.GA_ID': '"' + (process.env.GA_ID || 'UA-000000-01') + '"',
                'process.env.CLARITY_ID': JSON.stringify(process.env.CLARITY_ID || ''),
                'process.env.COMPILE_API_URL': JSON.stringify(process.env.COMPILE_API_URL || '/api/compile')
            }),
            // Landing media assets (React landing bundles CSS via webpack)
            new CopyWebpackPlugin([{
                from: 'src/landing/media',
                to: 'static/landing'
            }]),
            // Block IDE at /ide → ide.html
            new HtmlWebpackPlugin({
                chunks: ['lib.min', 'esptool', 'gui'],
                template: 'src/playground/index.ejs',
                filename: 'ide.html',
                title: 'TinkerBit IDE',
                sentryConfig: process.env.SENTRY_CONFIG ? '"' + process.env.SENTRY_CONFIG + '"' : null
            }),
            new HtmlWebpackPlugin({
                chunks: ['lib.min', 'esptool', 'blocksonly'],
                template: 'src/playground/index.ejs',
                filename: 'blocks-only.html',
                title: 'TinkerBit IDE: Blocks Only Example'
            }),
            new HtmlWebpackPlugin({
                chunks: ['lib.min', 'esptool', 'compatibilitytesting'],
                template: 'src/playground/index.ejs',
                filename: 'compatibility-testing.html',
                title: 'TinkerBit IDE: Compatibility Testing'
            }),
            new HtmlWebpackPlugin({
                chunks: ['lib.min', 'esptool', 'player'],
                template: 'src/playground/index.ejs',
                filename: 'player.html',
                title: 'TinkerBit IDE: Player Example'
            }),
            new CopyWebpackPlugin([{
                from: 'static',
                to: 'static'
            }]),
            new CopyWebpackPlugin([{
                from: 'node_modules/openblock-blocks/media',
                to: 'static/blocks-media'
            }]),
            new CopyWebpackPlugin([{
                from: 'extensions/**',
                to: 'static',
                context: 'src/examples'
            }]),
            new CopyWebpackPlugin([{
                from: 'extension-worker.{js,js.map}',
                context: 'node_modules/openblock-vm/dist/web'
            }])
        ])
    }),
    // Marketing site + login as lightweight React bundles (not IDE lib.min/esptool)
    (() => {
        const site = defaultsDeep({}, base, {
            name: 'tinkerbit-site',
            entry: {
                'site-vendor': ['react', 'react-dom'],
                landing: './src/site/landing/index.jsx',
                login: './src/site/login/index.jsx'
            },
            output: {
                path: path.resolve(__dirname, 'build'),
                filename: '[name].js',
                chunkFilename: 'chunks/[name].js'
            },
            optimization: {
                splitChunks: {
                    chunks: 'all',
                    name: 'site-vendor'
                },
                runtimeChunk: {
                    name: 'site-vendor'
                }
            }
        });
        delete site.output.library;
        site.plugins = [
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': '"' + process.env.NODE_ENV + '"',
                'process.env.CLARITY_ID': JSON.stringify(process.env.CLARITY_ID || '')
            }),
            new HtmlWebpackPlugin({
                chunks: ['site-vendor', 'landing'],
                template: 'src/site/site.ejs',
                filename: 'index.html',
                title: 'TinkerBit — Block Coding Meets Real Circuits | Fun STEM Kits',
                description: 'Drag-and-drop coding meets snap-in RJ11 boards. No wires, no soldering — just click, code, and watch it come alive. Perfect for kids and classrooms.',
                canonical: 'https://tinkerbit.io/',
                extraHead: [
                    '<meta property="og:type" content="website">',
                    '<meta property="og:site_name" content="TinkerBit">',
                    '<meta property="og:title" content="TinkerBit — Block Coding Meets Real Circuits">',
                    '<meta property="og:description" content="Drag-and-drop coding meets snap-in RJ11 boards. No wires, no soldering — just click, code, and watch it come alive.">',
                    '<meta property="og:url" content="https://tinkerbit.io/">',
                    '<meta property="og:image" content="https://tinkerbit.io/static/landing/og-image.png">',
                    '<meta name="twitter:card" content="summary_large_image">',
                    '<meta name="twitter:title" content="TinkerBit — Block Coding Meets Real Circuits">',
                    '<meta name="twitter:description" content="Drag-and-drop coding meets snap-in RJ11 boards. No wires, no soldering — just click, code, and watch it come alive.">',
                    '<meta name="twitter:image" content="https://tinkerbit.io/static/landing/og-image.png">',
                    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"TinkerBit","description":"Block-based coding platform paired with RJ11 snap-in circuit boards and modules for kids.","brand":{"@type":"Brand","name":"TinkerBit"},"url":"https://tinkerbit.io/","image":"https://tinkerbit.io/static/landing/og-image.png"}</script>'
                ].join('\n    ')
            }),
            new HtmlWebpackPlugin({
                chunks: ['site-vendor', 'login'],
                template: 'src/site/site.ejs',
                filename: 'login.html',
                title: 'Sign in — TinkerBit',
                description: 'Sign in with Google to open the TinkerBit IDE.',
                robots: 'noindex',
                canonical: 'https://tinkerbit.io/login',
                extraHead: [
                    // Allow Clarity CDN + Google fonts; keep frame-ancestors locked down.
                    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src \'self\' data: https:; script-src \'self\' https://*.clarity.ms https://c.bing.com; connect-src \'self\' https://*.clarity.ms https://c.bing.com; frame-ancestors \'none\'; base-uri \'self\'; form-action \'self\'">',
                    '<meta http-equiv="X-Frame-Options" content="DENY">'
                ].join('\n    ')
            })
        ];
        return site;
    })()
].concat(
    process.env.NODE_ENV === 'production' || process.env.BUILD_MODE === 'dist' ? (
        // export as library
        defaultsDeep({}, base, {
            target: 'web',
            entry: {
                'openblock-gui': './src/index.js'
            },
            output: {
                libraryTarget: 'umd',
                path: path.resolve('dist'),
                publicPath: `${STATIC_PATH}/`
            },
            externals: {
                'react': 'react',
                'react-dom': 'react-dom'
            },
            module: {
                rules: base.module.rules.concat([
                    {
                        test: /\.(svg|png|wav|gif|jpg|ttf)$/,
                        loader: 'file-loader',
                        options: {
                            outputPath: 'static/assets/',
                            publicPath: `${STATIC_PATH}/assets/`
                        }
                    }
                ])
            },
            plugins: base.plugins.concat([
                new CopyWebpackPlugin([{
                    from: 'node_modules/openblock-blocks/media',
                    to: 'static/blocks-media'
                }]),
                new CopyWebpackPlugin([{
                    from: 'extension-worker.{js,js.map}',
                    context: 'node_modules/openblock-vm/dist/web'
                }]),
                // Include library JSON files for scratch-desktop to use for downloading
                new CopyWebpackPlugin([{
                    from: 'src/lib/libraries/*.json',
                    to: 'libraries',
                    flatten: true
                }])
            ])
        })) : []
);
