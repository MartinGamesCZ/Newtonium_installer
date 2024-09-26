import { useEffect, useState } from "react";
import { isFunctionTypeNode } from "typescript";

interface IScreenSelect {
  type: "select";
  title: string;
  state_id: string;
  options: string[][] | ((state: any) => string[][]);
}

interface IScreenText {
  type: "text";
  title: string;
  state_id: string;
  text: string | ((state: any) => string);
}

interface IScreenInput {
  type: "input";
  title: string;
  state_id: string;
  default: string;
}

interface IScreenCheckbox {
  type: "checkbox";
  title: string;
  state_id: string;
  default: boolean;
  text: string | ((state: any) => string);
}

export type Screen =
  | IScreenSelect
  | IScreenText
  | IScreenInput
  | IScreenCheckbox;

interface IScreenRendererProps {
  screen: Screen;
  state: any;
  setState: (state: any) => void;
}

export default function ScreenRenderer({
  screen,
  state,
  setState,
}: IScreenRendererProps) {
  const children = renderType(screen.type, screen, state, setState);

  return (
    <>
      <h2>{screen.title}</h2>
      {children}
    </>
  );
}

function renderType(
  type: Screen["type"],
  screen: Screen,
  state: any,
  setState: (state: any) => void,
) {
  switch (type) {
    case "select":
      return (
        <SelectScreen
          screen={screen as IScreenSelect}
          state={state}
          setState={setState}
        />
      );
    case "text":
      return <TextScreen screen={screen as IScreenText} state={state} />;
    case "input":
      return (
        <InputScreen
          screen={screen as IScreenInput}
          state={state}
          setState={setState}
        />
      );
    case "checkbox":
      return (
        <CheckboxScreen
          screen={screen as IScreenCheckbox}
          state={state}
          setState={setState}
        />
      );
  }
}

function SelectScreen({
  screen,
  state,
  setState,
}: {
  screen: IScreenSelect;
  state: any;
  setState: (state: any) => void;
}) {
  return (
    <select
      onChange={(e) =>
        setState((a: any) => {
          a[screen.state_id] = e.target.value;
          return a;
        })
      }
    >
      {(typeof screen.options == "object"
        ? screen.options
        : screen.options(state)
      ).map(([label, value]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

function TextScreen({ state, screen }: { screen: IScreenText; state: any }) {
  return (
    <p>
      {typeof screen.text == "string"
        ? screen.text.split("\n").map((a, i, p) => {
            return (
              <>
                {a}
                {i < p.length - 1 && <br />}
              </>
            );
          })
        : screen
            .text(state)
            .split("\n")
            .map((a, i, p) => {
              return (
                <>
                  {a}
                  {i < p.length - 1 && <br />}
                </>
              );
            })}
    </p>
  );
}

function InputScreen({
  screen,
  state,
  setState,
}: {
  screen: IScreenInput;
  state: any;
  setState: (state: any) => void;
}) {
  const [value, setValue] = useState(state[screen.state_id] || screen.default);

  useEffect(() => {
    if (!state[screen.state_id]) {
      setState((a: any) => {
        a[screen.state_id] = screen.default;
        return a;
      });
      setValue(screen.default);
    }
  }, [screen.default]);

  useEffect(() => {
    if (value === state[screen.state_id]) return;
    setState((a: any) => {
      a[screen.state_id] = value;
      return a;
    });
  }, [value]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
      }}
    />
  );
}

function CheckboxScreen({
  screen,
  state,
  setState,
}: {
  screen: IScreenCheckbox;
  state: any;
  setState: (state: any) => void;
}) {
  const [value, setValue] = useState(state[screen.state_id] || screen.default);

  useEffect(() => {
    if (!state[screen.state_id]) {
      setState((a: any) => {
        a[screen.state_id] = screen.default;
        return a;
      });
      setValue(screen.default);
    }
  }, [screen.default]);

  useEffect(() => {
    if (value === state[screen.state_id]) return;
    setState((a: any) => {
      a[screen.state_id] = value;
      return a;
    });
  }, [value]);

  return (
    <div className="row">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => {
          setValue(e.target.checked);
        }}
      />
      <p>{typeof screen.text == "string" ? screen.text : screen.text(state)}</p>
    </div>
  );
}
