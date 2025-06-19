import React, { useState } from 'react';
import { WebView } from 'react-native-webview';
import { ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface KaTeXProps {
    latex: string;
    isOption?: boolean;
    fontSize?: string;
    height?: string;
}

export function KaTeX({ latex, isOption, fontSize = '1em', height = '60px' }: KaTeXProps) {
    const [webViewHeight, setWebViewHeight] = useState(60);
    const { isDark } = useTheme();

    const textColor = isDark ? '#4ADE80' : '#334155';
    const backgroundColor = isDark ? 'transparent' : 'transparent';

    const html = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
                <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
                <style>
                    :root {
                        color-scheme: ${isDark ? 'dark' : 'light'};
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 100vw;
                        height: 100vh;
                        box-sizing: border-box;
                        background-color: ${backgroundColor};
                        color: ${textColor};
                        overflow-x: auto;
                        overflow-y: hidden;
                    }
                    body {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 100vw;
                        height: ${height};
                        overflow-x: auto;
                        overflow-y: hidden;
                    }
                    #formula {
                        width: 100%;
                        height: 100%;
                        color: ${textColor};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-sizing: border-box;
                        overflow-x: auto;
                        overflow-y: hidden;
                        padding: 0 8px;
                    }
                    .katex {
                        font-size: ${fontSize};
                        color: ${textColor} !important;
                        text-align: center;
                        line-height: 1.5;
                        min-width: 100%;
                        box-sizing: border-box;
                        overflow-x: auto;
                        overflow-y: hidden;
                    }
                    .katex-display {
                        margin: 0;
                        padding: 0;
                        overflow-x: auto;
                        overflow-y: hidden;
                        text-align: center !important;
                        color: ${textColor} !important;
                        line-height: 1.5;
                        min-width: 100%;
                        box-sizing: border-box;
                    }
                    .katex-display > .katex {
                        text-align: center !important;
                        color: ${textColor} !important;
                        line-height: 2;
                        min-width: 100%;
                        box-sizing: border-box;
                    }
                    .katex .base { color: ${textColor} !important; }
                    .katex .mord { color: ${textColor} !important; }
                    .katex .mbin { color: ${textColor} !important; }
                    .katex .mrel { color: ${textColor} !important; }
                    .katex .mopen { color: ${textColor} !important; }
                    .katex .mclose { color: ${textColor} !important; }
                    .katex .mpunct { color: ${textColor} !important; }
                    .katex .minner { color: ${textColor} !important; }
                    .katex .mord.text { color: ${textColor} !important; }
                    .katex .mspace { background-color: transparent; }
                    .katex .strut { color: ${textColor} !important; }
                    .katex .vlist { color: ${textColor} !important; }
                </style>
            </head>
            <body>
                <div id="formula"></div>
                <script>
                    document.addEventListener("DOMContentLoaded", function() {
                        katex.render(String.raw\`${latex}\`, document.getElementById("formula"), {
                            throwOnError: false,
                            displayMode: true,
                            trust: true,
                            strict: false,
                            output: 'html'
                        });
                        window.ReactNativeWebView.postMessage(document.documentElement.scrollHeight);
                    });
                </script>
            </body>
        </html>
    `;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ flexGrow: 1 }}
        >
            <WebView
                source={{ html }}
                style={{ height: webViewHeight, backgroundColor, minWidth: '100%' }}
                scrollEnabled={false}
                onMessage={(event) => {
                    const height = parseInt(event.nativeEvent.data);
                    setWebViewHeight(height);
                }}
            />
        </ScrollView>
    );
} 