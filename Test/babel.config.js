const presets = [
    [
        '@babel/preset-env',
        {
            targets: {
                node: 'current',
            },
        },
    ],
];

const plugins = [
    '@babel/plugin-syntax-import-meta'
];

export default { presets, plugins };