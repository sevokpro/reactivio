const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env) =>{
    return {
        entry: {
            index: './src/index.ts'
        },
        output: {
            filename: '[name].js',
            path: `${__dirname}/dist/`
        },
        devtool: 'source-map',
        resolve: {
            extensions: ['.ts', '.js'],
            modules: [
                `${__dirname}/node_modules`,
                `${__dirname}/`
            ]
        },
        module: {
            rules: [{
                test: /\.ts$/,
                use: [`awesome-typescript-loader`]
            }]
        },
        plugins: [
            new HtmlWebpackPlugin()
        ]
    }
}