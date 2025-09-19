import React from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const Nav = styled.header`
  position: absolute;
  top: 0; left: 0; width: 100%;
  padding: 1rem 2rem; display: flex;
  justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(10px); z-index: 100;
`;

const Logo = styled.h1`font-weight: 700; margin: 0;`;
const NavLink = styled.a`margin-left: 2rem; font-weight: 500;`;
const LangSelect = styled.select`margin-left: 1rem;`;

export default function Navbar() {
  const { i18n } = useTranslation();

  return (
    <Nav>
      <Logo>Origami Creative</Logo>
      <div>
        <NavLink href="/">Home</NavLink>
        <NavLink href="#work">Work</NavLink>
        <NavLink href="#contact">Contact</NavLink>
        <LangSelect value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)}>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </LangSelect>
      </div>
    </Nav>
  );
}
