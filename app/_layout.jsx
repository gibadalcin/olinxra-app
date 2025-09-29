import React from "react";

export default function Layout({ children }) {
    return (
        <div>
            <header>OlinxRA App</header>
            <main>{children}</main>
        </div>
    );
}