import React from "react";

export default function TabsLayout({ children }) {
    return (
        <div>
            <nav>
                <span>Explorar</span> | <span>Reconhecer</span> | <span>Ajuda</span> | <span>Opções</span>
            </nav>
            <section>{children}</section>
        </div>
    );
}