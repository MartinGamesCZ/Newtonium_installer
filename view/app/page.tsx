"use client";

import Image from "next/image";
import styles from "./page.module.scss";
import { useState } from "react";
import ScreenRenderer, { Screen } from "./helpers/ScreenRenderer";

const screens =
  typeof window != "undefined" && "ni_screen" in window
    ? (window.ni_screen as unknown as any[])
    : [
        {
          id: "language",
          title: "Select your language",
          type: "$/language",
          back: {
            disabled: true,
          },
          next: {
            title: "Next",
            screen: "location",
          },
        },
        {
          id: "location",
          title: "Choose install location",
          type: "$/location",
          back: {
            title: "Back",
            screen: "language",
          },
          next: {
            title: "Next",
            screen: "shortcut",
          },
        },
        {
          id: "shortcut",
          title: "Configure shortcuts",
          type: "$/shortcut",
          back: {
            title: "Back",
            screen: "location",
          },
          next: {
            title: "Next",
            screen: "details",
          },
        },
        {
          id: "details",
          title: "Check details",
          type: "$/details",
          back: {
            title: "Back",
            screen: "shortcut",
          },
          next: {
            title: "Install",
            action: "$/install",
          },
        },
      ];

const $: {
  screen: {
    [key: string]: Screen;
  };
  action: {
    [key: string]: (state: any) => void;
  };
} = {
  screen: {
    language: {
      title: "Select your language",
      type: "select",
      options: [
        ["English", "en"],
        ["Čeština", "cs"],
      ],
      state_id: "language",
    },
    location: {
      title: "Choose install location",
      type: "input",
      default: "/usr/local/Newtonium",
      state_id: "location",
    },
    shortcut: {
      title: "Configure shortcuts",
      type: "checkbox",
      text: "Create desktop shortcut",
      default: true,
      state_id: "shortcut",
    },
    details: {
      title: "Check details",
      type: "text",
      text: (state: any) =>
        `Location: ${state.location}\nShortcut: ${state.shortcut ? "Yes" : "No"}`,
      state_id: "details",
    },
  },
  action: {
    install: (state: any) => {
      console.log("Installing", state);
    },
  },
};

export default function Page() {
  const [screen, setScreen] = useState("language");
  const [state, setState] = useState({});

  const screenDefinition = screens.find((s) => s.id == screen);
  const screenData = $.screen[screenDefinition.type.split("/")[1]];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <Image src="/icon.png" alt="logo" width={100} height={100} />
        </div>
        <div>
          <h1>Newtonium setup</h1>
        </div>
      </div>
      <div className={styles.body}>
        <ScreenRenderer screen={screenData} state={state} setState={setState} />
      </div>
      <div className={styles.buttons}>
        <button
          onClick={() => {
            if (screenDefinition.back && !screenDefinition.back.disabled) {
              if (screenDefinition.back.action) {
                $.action[screenDefinition.back.action.split("/")[1]](state);
              } else {
                setScreen(screenDefinition.back.screen);
              }
            }
          }}
        >
          Back
        </button>
        <button
          onClick={() => {
            if (screenDefinition.next && !screenDefinition.next.disabled) {
              if (screenDefinition.next.action) {
                $.action[screenDefinition.next.action.split("/")[1]](state);
              } else {
                setScreen(screenDefinition.next.screen);
              }
            }
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
