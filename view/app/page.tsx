"use client";

import Image from "next/image";
import styles from "./page.module.scss";
import { useEffect, useState } from "react";
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
        {
          id: "error",
          title: "Error",
          type: "$/error",
          back: {
            disabled: true,
          },
          next: {
            title: "Retry",
            screen: "language",
          },
        },
        {
          id: "done",
          title: "Done",
          type: "$/done",
          back: {
            title: "Close",
            action: "$/close",
          },
          next: {
            title: "Launch app",
            action: "$/launch",
          },
        },
        {
          id: "progress",
          title: "Installing",
          type: "$/progress",
          back: {
            disabled: true,
          },
          next: {
            disabled: true,
          },
        },
      ];

const $: {
  screen: {
    [key: string]: Screen;
  };
  action: {
    [key: string]: (state: any, setScreen: any) => void;
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
      default:
        typeof window != "undefined"
          ? (window as any).nai.default_location
          : "/usr/local/MyNewtoniumApp",
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
    error: {
      title: "Error",
      type: "text",
      text: (state: any) => state.error,
      state_id: "error",
    },
    done: {
      title: "Done",
      type: "text",
      text: "Installation complete",
      state_id: "done",
    },
    progress: {
      title: "Installing",
      type: "text",
      text: "Please wait...",
      state_id: "progress",
    },
  },
  action: {
    install: (state: any, setScreen: any) => {
      setScreen("progress");
      (window as any).ipc.postMessage("install;" + JSON.stringify(state));
    },
    close: () => {
      (window as any).ipc.postMessage("close;{}");
    },
    launch: (state: any, setScreen: any) => {
      (window as any).ipc.postMessage("launch;" + JSON.stringify(state));
    },
  },
};

export default function Page() {
  const [screen, setScreen] = useState("language");
  const [state, setState] = useState({});

  const screenDefinition = screens.find((s) => s.id == screen);
  const screenData = $.screen[screenDefinition.type.split("/")[1]];

  useEffect(() => {
    if (typeof window == "undefined") return;

    (window as any).setStatus = (data: any) => {
      switch (data.type) {
        case "ok":
          setScreen("done");
          break;
        case "err":
          setScreen("error");
          setState({ error: data.data });
          break;
        case "unknown":
          setScreen("error");
          setState({ error: "Unknown error\n" + data.data });
          break;
        case "progress":
          setScreen("progress");
          break;
      }
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <Image
            src={
              "nai://" +
              (typeof window != "undefined"
                ? "nai_res" + (window as any).nai.icon
                : "logo.png")
            }
            alt="logo"
            width={100}
            height={100}
          />
        </div>
        <div>
          <h1>
            {typeof window != "undefined"
              ? (window as any).nai.title
              : "Newtonium setup"}
          </h1>
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
                $.action[screenDefinition.back.action.split("/")[1]](
                  state,
                  setScreen,
                );
              } else {
                setScreen(screenDefinition.back.screen);
              }
            }
          }}
          style={
            screenDefinition.back && screenDefinition.back.disabled
              ? { display: "none" }
              : {}
          }
        >
          {screenDefinition.back && screenDefinition.back.title
            ? screenDefinition.back.title
            : "Back"}
        </button>
        <button
          onClick={() => {
            if (screenDefinition.next && !screenDefinition.next.disabled) {
              if (screenDefinition.next.action) {
                $.action[screenDefinition.next.action.split("/")[1]](
                  state,
                  setScreen,
                );
              } else {
                setScreen(screenDefinition.next.screen);
              }
            }
          }}
          style={
            screenDefinition.next && screenDefinition.next.disabled
              ? { display: "none" }
              : {}
          }
        >
          {screenDefinition.next && screenDefinition.next.title
            ? screenDefinition.next.title
            : "Next"}
        </button>
      </div>
    </div>
  );
}
