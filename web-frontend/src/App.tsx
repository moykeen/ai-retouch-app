import React from "react";

import {
  Authenticator,
  Flex,
  Image,
  useTheme,
  ColorMode,
  View,
  defaultDarkModeOverride,
  ThemeProvider,
} from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import { observer } from "mobx-react-lite";

import background from "./assets/signin-background.jpg";
import Home from "./Home";
import useStore from "./hooks/useStore";

import "@aws-amplify/ui-react/styles.css";

Amplify.configure({
  Auth: {
    region: "ap-northeast-1",
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    userPoolWebClientId: process.env.REACT_APP_APP_CLIENT_ID,
  },
});

const App: React.FC = observer(() => {
  const { tokens } = useTheme();
  const colorMode: ColorMode = "dark";
  const theme = {
    name: "my-theme",
    overrides: [defaultDarkModeOverride],
  };

  const { authStore } = useStore();

  const formFields = {
    signUp: {
      "custom:invitation": {
        placeholder: "Enter your invitation code",
        order: 1,
      },
      username: {
        order: 2,
      },
      email: {
        order: 3,
      },
      password: {
        order: 4,
      },
      confirm_password: {
        order: 5,
      },
    },
  };

  return (
    <ThemeProvider theme={theme} colorMode={colorMode}>
      <Flex
        backgroundColor={tokens.colors.background.primary}
        justifyContent="center"
      >
        {!authStore.username && (
          <View height="100vh">
            <Image
              padding={"0px"}
              src={background}
              width="100%"
              height="100%"
              objectFit="cover"
              alt=""
            />
          </View>
        )}
        <Authenticator initialState="signIn" formFields={formFields}>
          {({ user, signOut }) => <Home user={user} signOut={signOut} />}
        </Authenticator>
        {!authStore.username && (
          <View height="100vh">
            <Image
              padding={"0px"}
              src={background}
              width="100%"
              height="100%"
              objectFit="cover"
              alt=""
            />
          </View>
        )}
      </Flex>
    </ThemeProvider>
  );
});

export default App;
