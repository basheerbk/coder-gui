// Exported once from the old studio source; the kit is now the source of truth, so edit by hand.

export const SCENE = {
    "x": -50,
    "y": -110,
    "w": 940,
    "h": 700
};

export const BOARD = {
    "x": 150,
    "y": 105,
    "w": 480,
    "h": 300
};

export const JACK = {
    "w": 30,
    "h": 36
};

export const CARD = {
    "w": 112,
    "h": 38
};

export const STUB = 56;

export const SLAB_T = 7;

export const PCB_H = 1.6;

export const JACK_H = 16;

export const MOD_H = 3;

export const CAN_H = 5;

export const USB_H = 9;

export const GOLD = "#c9a34c";

export const MOD = {
    "x": 190,
    "y": 82,
    "w": 100,
    "h": 140
};

export const ANTENNA_H = 40;

export const CAN = {
    "x": 194,
    "y": 124,
    "w": 92,
    "d": 92
};

export const U1 = {
    "body": {
        "x": 70,
        "y": 175,
        "w": 28,
        "h": 22
    },
    "tab": {
        "x": 77,
        "y": 170,
        "w": 14,
        "h": 6
    }
};

export const U4 = {
    "body": {
        "x": 389,
        "y": 190,
        "w": 22,
        "h": 30
    },
    "dot": {
        "x": 394,
        "y": 195
    }
};

export const USB = {
    "x": 215,
    "y": 262,
    "w": 50,
    "h": 44
};

export const LEDS = [
    {
        "x": 256,
        "y": 240,
        "color": "#ff2828",
        "mode": "power"
    },
    {
        "x": 270,
        "y": 240,
        "color": "#288cff",
        "mode": "activity"
    },
    {
        "x": 284,
        "y": 240,
        "color": "#28dc6e",
        "mode": "heartbeat"
    }
];

export const BUTTONS = [
    {
        "x": 100,
        "y": 268
    },
    {
        "x": 138,
        "y": 268
    }
];

export const PASSIVES = [
    {
        "x": 74,
        "y": 100,
        "kind": "C",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 88,
        "y": 100,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 102,
        "y": 100,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 116,
        "y": 100,
        "kind": "C",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 74,
        "y": 122,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 88,
        "y": 122,
        "kind": "C",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 102,
        "y": 122,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 116,
        "y": 122,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 374,
        "y": 82,
        "kind": "C",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 388,
        "y": 82,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 402,
        "y": 82,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 374,
        "y": 100,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 388,
        "y": 100,
        "kind": "C",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 402,
        "y": 100,
        "kind": "R",
        "horizontal": false,
        "w": 6,
        "h": 11
    },
    {
        "x": 204,
        "y": 240,
        "kind": "R",
        "horizontal": true,
        "w": 11,
        "h": 6
    },
    {
        "x": 219,
        "y": 240,
        "kind": "C",
        "horizontal": true,
        "w": 11,
        "h": 6
    },
    {
        "x": 234,
        "y": 240,
        "kind": "R",
        "horizontal": true,
        "w": 11,
        "h": 6
    }
];

export const CAST = {
    "x": [
        10,
        20,
        30,
        40,
        50,
        60,
        70,
        80,
        90
    ],
    "y": [
        50,
        60,
        70,
        80,
        90,
        100,
        110,
        120,
        130
    ]
};

export const PORTS = [
    {
        "id": "STEPPER",
        "label": "ST",
        "side": "top",
        "kind": "stepper",
        "open": "N",
        "pos": {
            "x": 198,
            "y": 74,
            "cableX": 213,
            "cableY": 74,
            "cardX": 157,
            "cardY": -20
        },
        "footprint": {
            "x": 195,
            "y": 77,
            "w": 36,
            "d": 30
        },
        "labelBox": {
            "x": 192,
            "y": 108,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#9ca3af",
            "light": "#6b7280"
        }
    },
    {
        "id": "D13",
        "label": "D13",
        "side": "top",
        "kind": "digital",
        "open": "N",
        "pos": {
            "x": 316,
            "y": 74,
            "cableX": 331,
            "cableY": 74,
            "cardX": 275,
            "cardY": -20
        },
        "footprint": {
            "x": 313,
            "y": 77,
            "w": 36,
            "d": 30
        },
        "labelBox": {
            "x": 307,
            "y": 108,
            "w": 48,
            "d": 27
        },
        "colors": {
            "dark": "#3b82f6",
            "light": "#3b82f6"
        }
    },
    {
        "id": "3D",
        "label": "3D",
        "side": "top",
        "kind": "spi",
        "open": "N",
        "pos": {
            "x": 434,
            "y": 74,
            "cableX": 449,
            "cableY": 74,
            "cardX": 393,
            "cardY": -20
        },
        "footprint": {
            "x": 431,
            "y": 77,
            "w": 36,
            "d": 30
        },
        "labelBox": {
            "x": 428,
            "y": 108,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#8b5cf6",
            "light": "#8b5cf6"
        }
    },
    {
        "id": "D5",
        "label": "D5",
        "side": "top",
        "kind": "digital",
        "open": "N",
        "pos": {
            "x": 552,
            "y": 74,
            "cableX": 567,
            "cableY": 74,
            "cardX": 511,
            "cardY": -20
        },
        "footprint": {
            "x": 549,
            "y": 77,
            "w": 36,
            "d": 30
        },
        "labelBox": {
            "x": 546,
            "y": 108,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#3b82f6",
            "light": "#3b82f6"
        }
    },
    {
        "id": "MD",
        "label": "MD",
        "side": "right",
        "kind": "motor",
        "open": "E",
        "pos": {
            "x": 625,
            "y": 147,
            "cableX": 655,
            "cableY": 165,
            "cardX": 711,
            "cardY": 146
        },
        "footprint": {
            "x": 625,
            "y": 147,
            "w": 30,
            "d": 36
        },
        "labelBox": {
            "x": 581,
            "y": 152,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#f59e0b",
            "light": "#f59e0b"
        }
    },
    {
        "id": "I2C",
        "label": "I2C",
        "side": "right",
        "kind": "i2c",
        "open": "E",
        "pos": {
            "x": 625,
            "y": 205,
            "cableX": 655,
            "cableY": 223,
            "cardX": 711,
            "cardY": 204
        },
        "footprint": {
            "x": 625,
            "y": 205,
            "w": 30,
            "d": 36
        },
        "labelBox": {
            "x": 575,
            "y": 210,
            "w": 48,
            "d": 27
        },
        "colors": {
            "dark": "#06b6d4",
            "light": "#06b6d4"
        }
    },
    {
        "id": "A3",
        "label": "A3",
        "side": "right",
        "kind": "analog",
        "open": "E",
        "pos": {
            "x": 625,
            "y": 263,
            "cableX": 655,
            "cableY": 281,
            "cardX": 711,
            "cardY": 262
        },
        "footprint": {
            "x": 625,
            "y": 263,
            "w": 30,
            "d": 36
        },
        "labelBox": {
            "x": 581,
            "y": 268,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#10b981",
            "light": "#10b981"
        }
    },
    {
        "id": "A2",
        "label": "A2",
        "side": "right",
        "kind": "analog",
        "open": "E",
        "pos": {
            "x": 625,
            "y": 321,
            "cableX": 655,
            "cableY": 339,
            "cardX": 711,
            "cardY": 320
        },
        "footprint": {
            "x": 625,
            "y": 321,
            "w": 30,
            "d": 36
        },
        "labelBox": {
            "x": 581,
            "y": 326,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#10b981",
            "light": "#10b981"
        }
    },
    {
        "id": "A1",
        "label": "A1",
        "side": "bottom",
        "kind": "analog",
        "open": "S",
        "pos": {
            "x": 198,
            "y": 400,
            "cableX": 213,
            "cableY": 436,
            "cardX": 157,
            "cardY": 492
        },
        "footprint": {
            "x": 195,
            "y": 403,
            "w": 36,
            "d": 30
        },
        "labelBox": {
            "x": 192,
            "y": 374,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#10b981",
            "light": "#10b981"
        }
    },
    {
        "id": "A4",
        "label": "A4",
        "side": "bottom",
        "kind": "analog",
        "open": "S",
        "pos": {
            "x": 552,
            "y": 400,
            "cableX": 567,
            "cableY": 436,
            "cardX": 511,
            "cardY": 492
        },
        "footprint": {
            "x": 549,
            "y": 403,
            "w": 36,
            "d": 30
        },
        "labelBox": {
            "x": 546,
            "y": 374,
            "w": 42,
            "d": 27
        },
        "colors": {
            "dark": "#10b981",
            "light": "#10b981"
        }
    },
    {
        "id": "ONBOARD",
        "label": "ESP",
        "side": "left",
        "kind": "onboard",
        "open": "W",
        "pos": {
            "x": 125,
            "y": 165,
            "cableX": 125,
            "cableY": 183,
            "cardX": -43,
            "cardY": 164
        },
        "footprint": {
            "x": 125,
            "y": 165,
            "w": 30,
            "d": 36
        },
        "labelBox": {
            "x": 157,
            "y": 170,
            "w": 48,
            "d": 27
        },
        "colors": {
            "dark": "#06b6d4",
            "light": "#06b6d4"
        }
    },
    {
        "id": "UART",
        "label": "UART",
        "side": "left",
        "kind": "uart",
        "open": "W",
        "pos": {
            "x": 125,
            "y": 235,
            "cableX": 125,
            "cableY": 253,
            "cardX": -43,
            "cardY": 234
        },
        "footprint": {
            "x": 125,
            "y": 235,
            "w": 30,
            "d": 36
        },
        "labelBox": {
            "x": 157,
            "y": 240,
            "w": 56,
            "d": 27
        },
        "colors": {
            "dark": "#3b82f6",
            "light": "#3b82f6"
        }
    }
];

export const TRACE_POINTS = {
    "STEPPER": [
        [
            213,
            110
        ],
        [
            213,
            139
        ],
        [
            213.16666666666669,
            140.83333333333334
        ],
        [
            213.66666666666669,
            142.33333333333334
        ],
        [
            214.5,
            143.5
        ],
        [
            215.66666666666669,
            144.33333333333334
        ],
        [
            217.16666666666669,
            144.83333333333334
        ],
        [
            219,
            145
        ],
        [
            314,
            145
        ],
        [
            315.83333333333337,
            145.16666666666669
        ],
        [
            317.33333333333337,
            145.66666666666669
        ],
        [
            318.5,
            146.5
        ],
        [
            319.33333333333337,
            147.66666666666669
        ],
        [
            319.83333333333337,
            149.16666666666669
        ],
        [
            320,
            151
        ],
        [
            320,
            251
        ],
        [
            320.1666666666667,
            252.83333333333334
        ],
        [
            320.6666666666667,
            254.33333333333334
        ],
        [
            321.5,
            255.5
        ],
        [
            322.6666666666667,
            256.33333333333337
        ],
        [
            324.1666666666667,
            256.83333333333337
        ],
        [
            326,
            257
        ],
        [
            340,
            257
        ]
    ],
    "D13": [
        [
            331,
            110
        ],
        [
            331,
            232.5
        ],
        [
            331.125,
            233.875
        ],
        [
            331.5,
            235
        ],
        [
            332.125,
            235.875
        ],
        [
            333,
            236.5
        ],
        [
            334.125,
            236.875
        ],
        [
            335.5,
            237
        ],
        [
            340,
            237
        ]
    ],
    "3D": [
        [
            449,
            110
        ],
        [
            449,
            232.5
        ],
        [
            448.875,
            233.875
        ],
        [
            448.50000000000006,
            235
        ],
        [
            447.875,
            235.875
        ],
        [
            447,
            236.5
        ],
        [
            445.875,
            236.875
        ],
        [
            444.5,
            237
        ],
        [
            440,
            237
        ]
    ],
    "D5": [
        [
            567,
            110
        ],
        [
            567,
            139
        ],
        [
            566.8333333333335,
            140.83333333333334
        ],
        [
            566.3333333333335,
            142.33333333333334
        ],
        [
            565.5,
            143.5
        ],
        [
            564.3333333333334,
            144.33333333333334
        ],
        [
            562.8333333333333,
            144.83333333333334
        ],
        [
            561,
            145
        ],
        [
            466,
            145
        ],
        [
            464.1666666666667,
            145.16666666666669
        ],
        [
            462.66666666666674,
            145.66666666666669
        ],
        [
            461.5,
            146.5
        ],
        [
            460.6666666666667,
            147.66666666666669
        ],
        [
            460.1666666666667,
            149.16666666666669
        ],
        [
            460,
            151
        ],
        [
            460,
            251
        ],
        [
            459.83333333333337,
            252.83333333333334
        ],
        [
            459.33333333333337,
            254.33333333333334
        ],
        [
            458.5,
            255.5
        ],
        [
            457.33333333333337,
            256.33333333333337
        ],
        [
            455.83333333333337,
            256.83333333333337
        ],
        [
            454,
            257
        ],
        [
            440,
            257
        ]
    ],
    "MD": [
        [
            625,
            165
        ],
        [
            486,
            165
        ],
        [
            484.16666666666674,
            165.16666666666669
        ],
        [
            482.66666666666674,
            165.66666666666669
        ],
        [
            481.5,
            166.5
        ],
        [
            480.6666666666667,
            167.66666666666669
        ],
        [
            480.1666666666667,
            169.16666666666666
        ],
        [
            480,
            171
        ],
        [
            480,
            261
        ],
        [
            479.83333333333337,
            262.83333333333337
        ],
        [
            479.33333333333337,
            264.33333333333337
        ],
        [
            478.5,
            265.5
        ],
        [
            477.33333333333337,
            266.33333333333337
        ],
        [
            475.83333333333337,
            266.83333333333337
        ],
        [
            474,
            267
        ],
        [
            440,
            267
        ]
    ],
    "I2C": [
        [
            625,
            223
        ],
        [
            506,
            223
        ],
        [
            504.1666666666667,
            223.16666666666669
        ],
        [
            502.66666666666674,
            223.66666666666669
        ],
        [
            501.5,
            224.5
        ],
        [
            500.6666666666667,
            225.66666666666669
        ],
        [
            500.1666666666667,
            227.16666666666669
        ],
        [
            500,
            229
        ],
        [
            500,
            271
        ],
        [
            499.83333333333337,
            272.83333333333337
        ],
        [
            499.3333333333334,
            274.33333333333337
        ],
        [
            498.5,
            275.5
        ],
        [
            497.33333333333337,
            276.3333333333333
        ],
        [
            495.8333333333333,
            276.83333333333337
        ],
        [
            494,
            277
        ],
        [
            440,
            277
        ]
    ],
    "A3": [
        [
            625,
            281
        ],
        [
            523,
            281
        ],
        [
            522.0833333333334,
            281.08333333333337
        ],
        [
            521.3333333333334,
            281.33333333333337
        ],
        [
            520.75,
            281.75
        ],
        [
            520.3333333333334,
            282.33333333333337
        ],
        [
            520.0833333333333,
            283.08333333333337
        ],
        [
            520,
            284
        ],
        [
            520,
            284
        ],
        [
            519.9166666666667,
            284.9166666666667
        ],
        [
            519.6666666666667,
            285.6666666666667
        ],
        [
            519.25,
            286.25
        ],
        [
            518.6666666666667,
            286.6666666666667
        ],
        [
            517.9166666666667,
            286.9166666666667
        ],
        [
            517,
            287
        ],
        [
            440,
            287
        ]
    ],
    "A2": [
        [
            625,
            339
        ],
        [
            506,
            339
        ],
        [
            504.1666666666667,
            338.83333333333337
        ],
        [
            502.66666666666674,
            338.33333333333337
        ],
        [
            501.5,
            337.5
        ],
        [
            500.6666666666667,
            336.33333333333337
        ],
        [
            500.1666666666667,
            334.8333333333333
        ],
        [
            500,
            333
        ],
        [
            500,
            303
        ],
        [
            499.83333333333337,
            301.16666666666674
        ],
        [
            499.3333333333334,
            299.66666666666674
        ],
        [
            498.5,
            298.5
        ],
        [
            497.33333333333337,
            297.6666666666667
        ],
        [
            495.8333333333333,
            297.1666666666667
        ],
        [
            494,
            297
        ],
        [
            440,
            297
        ]
    ],
    "A1": [
        [
            213,
            400
        ],
        [
            213,
            356
        ],
        [
            213.16666666666669,
            354.1666666666667
        ],
        [
            213.66666666666669,
            352.6666666666667
        ],
        [
            214.5,
            351.5
        ],
        [
            215.66666666666669,
            350.6666666666667
        ],
        [
            217.16666666666669,
            350.1666666666667
        ],
        [
            219,
            350
        ],
        [
            314,
            350
        ],
        [
            315.83333333333337,
            349.83333333333337
        ],
        [
            317.33333333333337,
            349.33333333333337
        ],
        [
            318.5,
            348.5
        ],
        [
            319.33333333333337,
            347.33333333333337
        ],
        [
            319.83333333333337,
            345.83333333333337
        ],
        [
            320,
            344
        ],
        [
            320,
            323
        ],
        [
            320.1666666666667,
            321.1666666666667
        ],
        [
            320.6666666666667,
            319.6666666666667
        ],
        [
            321.5,
            318.5
        ],
        [
            322.6666666666667,
            317.6666666666667
        ],
        [
            324.1666666666667,
            317.16666666666663
        ],
        [
            326,
            317
        ],
        [
            340,
            317
        ]
    ],
    "A4": [
        [
            567,
            400
        ],
        [
            567,
            356
        ],
        [
            566.8333333333335,
            354.1666666666667
        ],
        [
            566.3333333333335,
            352.6666666666667
        ],
        [
            565.5,
            351.5
        ],
        [
            564.3333333333334,
            350.6666666666667
        ],
        [
            562.8333333333333,
            350.1666666666667
        ],
        [
            561,
            350
        ],
        [
            466,
            350
        ],
        [
            464.1666666666667,
            349.83333333333337
        ],
        [
            462.66666666666674,
            349.33333333333337
        ],
        [
            461.5,
            348.5
        ],
        [
            460.6666666666667,
            347.33333333333337
        ],
        [
            460.1666666666667,
            345.83333333333337
        ],
        [
            460,
            344
        ],
        [
            460,
            323
        ],
        [
            459.83333333333337,
            321.1666666666667
        ],
        [
            459.33333333333337,
            319.6666666666667
        ],
        [
            458.5,
            318.5
        ],
        [
            457.33333333333337,
            317.6666666666667
        ],
        [
            455.83333333333337,
            317.16666666666663
        ],
        [
            454,
            317
        ],
        [
            440,
            317
        ]
    ],
    "ONBOARD": [
        [
            155,
            183
        ],
        [
            294,
            183
        ],
        [
            295.83333333333337,
            183.16666666666669
        ],
        [
            297.33333333333337,
            183.66666666666669
        ],
        [
            298.5,
            184.5
        ],
        [
            299.3333333333333,
            185.66666666666669
        ],
        [
            299.83333333333337,
            187.16666666666669
        ],
        [
            300,
            189
        ],
        [
            300,
            271
        ],
        [
            300.16666666666674,
            272.83333333333337
        ],
        [
            300.66666666666674,
            274.33333333333337
        ],
        [
            301.5,
            275.5
        ],
        [
            302.6666666666667,
            276.3333333333333
        ],
        [
            304.16666666666663,
            276.83333333333337
        ],
        [
            306,
            277
        ],
        [
            340,
            277
        ]
    ],
    "UART": [
        [
            155,
            253
        ],
        [
            274,
            253
        ],
        [
            275.83333333333337,
            253.16666666666669
        ],
        [
            277.33333333333337,
            253.66666666666669
        ],
        [
            278.5,
            254.5
        ],
        [
            279.3333333333333,
            255.66666666666669
        ],
        [
            279.83333333333337,
            257.1666666666667
        ],
        [
            280,
            259
        ],
        [
            280,
            291
        ],
        [
            280.1666666666667,
            292.83333333333337
        ],
        [
            280.6666666666667,
            294.33333333333337
        ],
        [
            281.5,
            295.5
        ],
        [
            282.6666666666667,
            296.33333333333337
        ],
        [
            284.1666666666667,
            296.83333333333337
        ],
        [
            286,
            297
        ],
        [
            340,
            297
        ]
    ]
};

export const THEMES = {
    "dark": {
        "canvas": "#0d1117",
        "panel": "#1f2937",
        "text": "#f9fafb",
        "analog": "#10b981",
        "digital": "#3b82f6"
    },
    "light": {
        "canvas": "#e8eef5",
        "panel": "#ffffff",
        "text": "#111827",
        "analog": "#10b981",
        "digital": "#3b82f6"
    }
};

export const MODULES = [
    {
        "id": "btn",
        "name": "Push Button",
        "color": "#3b82f6",
        "category": "input",
        "dir": "in"
    },
    {
        "id": "pot",
        "name": "Potentiometer",
        "color": "#8b5cf6",
        "category": "input",
        "dir": "in"
    },
    {
        "id": "led",
        "name": "LED",
        "color": "#8b5cf6",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "relay",
        "name": "Relay Module",
        "color": "#f59e0b",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "servo",
        "name": "Servo Motor",
        "color": "#3b82f6",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "l293d",
        "name": "L293D Motor Driver",
        "color": "#9ca3af",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "relay4",
        "name": "4-Ch Relay (MD)",
        "color": "#f59e0b",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "stepper",
        "name": "Stepper Motor",
        "color": "#9ca3af",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "oled",
        "name": "OLED Screen",
        "color": "#06b6d4",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "mq2",
        "name": "MQ-2 Gas Sensor",
        "color": "#6b7280",
        "category": "sensor",
        "dir": "in"
    },
    {
        "id": "mic",
        "name": "Microphone",
        "color": "#f59e0b",
        "category": "sensor",
        "dir": "in"
    },
    {
        "id": "pulse",
        "name": "Heartbeat HW-605",
        "color": "#ef4444",
        "category": "sensor",
        "dir": "in"
    },
    {
        "id": "soil",
        "name": "Capacitive Soil Moisture",
        "color": "#10b981",
        "category": "sensor",
        "dir": "in"
    },
    {
        "id": "dht",
        "name": "DHT11 Temp & Humid",
        "color": "#f59e0b",
        "category": "sensor",
        "dir": "in"
    },
    {
        "id": "ultra",
        "name": "HC-SR04 Ultrasonic",
        "color": "#06b6d4",
        "category": "sensor",
        "dir": "in"
    },
    {
        "id": "rfid",
        "name": "RFID RC522",
        "color": "#8b5cf6",
        "category": "sensor",
        "dir": "in"
    },
    {
        "id": "ble",
        "name": "Bluetooth (BLE)",
        "color": "#06b6d4",
        "category": "output",
        "dir": "out"
    },
    {
        "id": "hc05",
        "name": "HC-05 Bluetooth",
        "color": "#06b6d4",
        "category": "output",
        "dir": "out"
    }
];

export const TEXTURES = {
    "board-top": {
        "file": "assets/svg/board-top.svg",
        "w": 480,
        "h": 300,
        "ppu": 4,
        "base": "#f4f4f0",
        "kind": "board"
    },
    "esp-top": {
        "file": "assets/svg/esp-top.svg",
        "w": 100,
        "h": 140,
        "ppu": 6,
        "base": "#141414",
        "kind": "board"
    },
    "esp-can": {
        "file": "assets/svg/esp-can.svg",
        "w": 92,
        "h": 92,
        "ppu": 6,
        "base": "#c9c4b8",
        "kind": "board"
    },
    "u1-top": {
        "file": "assets/svg/u1-top.svg",
        "w": 28,
        "h": 22,
        "ppu": 6,
        "base": "#1a1b1d",
        "kind": "board"
    },
    "u4-top": {
        "file": "assets/svg/u4-top.svg",
        "w": 22,
        "h": 30,
        "ppu": 6,
        "base": "#1a1b1d",
        "kind": "board"
    },
    "usb-top": {
        "file": "assets/svg/usb-top.svg",
        "w": 50,
        "h": 44,
        "ppu": 6,
        "base": "#c9cbcd",
        "kind": "board"
    },
    "usb-front": {
        "file": "assets/svg/usb-front.svg",
        "w": 50,
        "h": 9,
        "ppu": 8,
        "base": "#c9cbcd",
        "kind": "board"
    },
    "label-STEPPER-dark": {
        "file": "assets/svg/label-STEPPER-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-D13-dark": {
        "file": "assets/svg/label-D13-dark.svg",
        "w": 48,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-3D-dark": {
        "file": "assets/svg/label-3D-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-D5-dark": {
        "file": "assets/svg/label-D5-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-MD-dark": {
        "file": "assets/svg/label-MD-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-I2C-dark": {
        "file": "assets/svg/label-I2C-dark.svg",
        "w": 48,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A3-dark": {
        "file": "assets/svg/label-A3-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A2-dark": {
        "file": "assets/svg/label-A2-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A1-dark": {
        "file": "assets/svg/label-A1-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A4-dark": {
        "file": "assets/svg/label-A4-dark.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-ONBOARD-dark": {
        "file": "assets/svg/label-ONBOARD-dark.svg",
        "w": 48,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-UART-dark": {
        "file": "assets/svg/label-UART-dark.svg",
        "w": 56,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "card-relay-dark": {
        "file": "assets/svg/card-relay-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "card-servo-dark": {
        "file": "assets/svg/card-servo-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "card-l293d-dark": {
        "file": "assets/svg/card-l293d-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "card-relay4-dark": {
        "file": "assets/svg/card-relay4-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "card-stepper-dark": {
        "file": "assets/svg/card-stepper-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "card-oled-dark": {
        "file": "assets/svg/card-oled-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "card-ble-dark": {
        "file": "assets/svg/card-ble-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "card-hc05-dark": {
        "file": "assets/svg/card-hc05-dark.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#1f2937",
        "kind": "card"
    },
    "label-STEPPER-light": {
        "file": "assets/svg/label-STEPPER-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-D13-light": {
        "file": "assets/svg/label-D13-light.svg",
        "w": 48,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-3D-light": {
        "file": "assets/svg/label-3D-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-D5-light": {
        "file": "assets/svg/label-D5-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-MD-light": {
        "file": "assets/svg/label-MD-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-I2C-light": {
        "file": "assets/svg/label-I2C-light.svg",
        "w": 48,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A3-light": {
        "file": "assets/svg/label-A3-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A2-light": {
        "file": "assets/svg/label-A2-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A1-light": {
        "file": "assets/svg/label-A1-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-A4-light": {
        "file": "assets/svg/label-A4-light.svg",
        "w": 42,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-ONBOARD-light": {
        "file": "assets/svg/label-ONBOARD-light.svg",
        "w": 48,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "label-UART-light": {
        "file": "assets/svg/label-UART-light.svg",
        "w": 56,
        "h": 27,
        "ppu": 6,
        "base": null,
        "kind": "label"
    },
    "card-relay-light": {
        "file": "assets/svg/card-relay-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    },
    "card-servo-light": {
        "file": "assets/svg/card-servo-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    },
    "card-l293d-light": {
        "file": "assets/svg/card-l293d-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    },
    "card-relay4-light": {
        "file": "assets/svg/card-relay4-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    },
    "card-stepper-light": {
        "file": "assets/svg/card-stepper-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    },
    "card-oled-light": {
        "file": "assets/svg/card-oled-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    },
    "card-ble-light": {
        "file": "assets/svg/card-ble-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    },
    "card-hc05-light": {
        "file": "assets/svg/card-hc05-light.svg",
        "w": 112,
        "h": 38,
        "ppu": 6,
        "base": "#ffffff",
        "kind": "card"
    }
};
