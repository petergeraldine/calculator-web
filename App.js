import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const IDLE_LIMIT = 15 * 60 * 1000; // 15 minutes

function MainApp() {
  const insets = useSafeAreaInsets();

  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [customResult, setCustomResult] = useState(null);

  // These remain but are no longer used for repeat "="
  const [lastOperator, setLastOperator] = useState(null);
  const [lastOperand, setLastOperand] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState("");

  const scrollRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // -----------------------------
  // TIMESTAMP IDLE SYSTEM
  // -----------------------------

  const markAC = async () => {
    await AsyncStorage.setItem("lastAC", Date.now().toString());
  };

  const checkIdleTime = async () => {
    const last = await AsyncStorage.getItem("lastAC");

    if (!last) {
      await markAC();
      return;
    }

    const diff = Date.now() - parseInt(last, 10);

    if (diff >= IDLE_LIMIT) {
      const random = Math.floor(1000 + Math.random() * 9000).toString();
      setExpression("");
      setDisplay(random);
      setJustEvaluated(false);
      await markAC();
    }
  };

  useEffect(() => {
    checkIdleTime();

    const sub = AppState.addEventListener("change", next => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        checkIdleTime();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, []);

  const resetIdle = async () => {
    await markAC();
  };

  // -----------------------------
  // CALCULATOR LOGIC
  // -----------------------------

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [expression]);

  const handleNumber = async (num) => {
    await resetIdle();

    if (justEvaluated) {
      setExpression("");
      setDisplay(String(num));
      setJustEvaluated(false);
      return;
    }
    if (display === "0") {
      setDisplay(String(num));
    } else {
      setDisplay(display + String(num));
    }
  };

  const handleDecimal = async () => {
    await resetIdle();

    if (justEvaluated) {
      setExpression("");
      setDisplay("0.");
      setJustEvaluated(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const handleLongPressDecimal = async () => {
    await resetIdle();
    setTempValue("");
    setModalVisible(true);
  };

  const handleDelete = async () => {
    await resetIdle();

    if (justEvaluated) return;

    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  const handleOperator = async (op) => {
    await resetIdle();

    if (justEvaluated) {
      setExpression(display + " " + op);
      setDisplay("0");
      setJustEvaluated(false);
      return;
    }
    const newExp = expression + " " + display + " " + op;
    setExpression(newExp.trim());
    setDisplay("0");
  };

  const handleClear = async () => {
    await resetIdle();

    setDisplay("0");
    setExpression("");
    setJustEvaluated(false);
  };

  const handlePercent = async () => {
    await resetIdle();
    setDisplay(String(parseFloat(display) / 100));
  };

  const evaluateMath = (exp) => {
    const jsExp = exp
      .replace(/×/g, "*")
      .replace(/÷/g, "/");

    try {
      return String(eval(jsExp));
    } catch {
      return "Error";
    }
  };

  // ----------------------------------------------------
  // UPDATED CALCULATE FUNCTION ( "=" inert after result )
  // ----------------------------------------------------
  const calculate = async () => {
    await resetIdle();

    const fullExp = (expression + " " + display).trim();

    // If no operator exists → do nothing
    const hasOperator = /[+\-×÷]/.test(fullExp);
    if (!hasOperator) {
      return;
    }

    // NEW RULE: If result is already shown and no new input → do nothing
    if (justEvaluated) {
      return;
    }

    const tokens = fullExp.split(" ");
    const numbers = tokens.filter(t => !["+", "-", "×", "÷"].includes(t));
    const numberCount = numbers.length;

    let result;

    if (numberCount >= 4) {
      if (customResult !== null) {
        result = customResult;
      } else {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, "0");
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const yy = String(today.getFullYear()).slice(-2);

        const raw = dd + mm + yy;
        result = raw.replace(/^0/, "");
      }
    } else {
      result = evaluateMath(fullExp);
    }

    setExpression(fullExp);
    setDisplay(result);
    setJustEvaluated(true);
  };

  const Button = ({ label, color, wide, onPress, onLongPress, delayLongPress }) => (
    <TouchableOpacity
      onPress={async () => { await resetIdle(); onPress(); }}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      style={[
        styles.button,
        { backgroundColor: color || "#333" },
        wide && styles.wideButton
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choose Result</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter custom number"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={tempValue}
              onChangeText={setTempValue}
              autoFocus
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={async () => {
                await resetIdle();
                setCustomResult(tempValue.trim() === "" ? null : tempValue.trim());
                setModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Use Custom Number</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={async () => {
                await resetIdle();
                setCustomResult(null);
                setModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Use Today's Date</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#444" }]}
              onPress={async () => {
                await resetIdle();
                setModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.container}>

        <View style={[styles.displayContainer, { paddingTop: insets.top + 10 }]}>
          <View style={styles.historyWrapper}>
            <ScrollView
              horizontal
              ref={scrollRef}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
            >
              <Text style={styles.historyText}>{expression}</Text>
            </ScrollView>
          </View>

          <Text style={styles.displayText} numberOfLines={1}>
            {display}
          </Text>
        </View>

        <View style={styles.row}>
          <Button label="⌫" color="#A5A5A5" onPress={handleDelete} />
          <Button label="AC" color="#A5A5A5" onPress={handleClear} />
          <Button label="%" color="#A5A5A5" onPress={handlePercent} />
          <Button label="÷" color="#FF9F0A" onPress={() => handleOperator("÷")} />
        </View>

        <View style={styles.row}>
          <Button label="7" onPress={() => handleNumber(7)} />
          <Button label="8" onPress={() => handleNumber(8)} />
          <Button label="9" onPress={() => handleNumber(9)} />
          <Button label="×" color="#FF9F0A" onPress={() => handleOperator("×")} />
        </View>

        <View style={styles.row}>
          <Button label="4" onPress={() => handleNumber(4)} />
          <Button label="5" onPress={() => handleNumber(5)} />
          <Button label="6" onPress={() => handleNumber(6)} />
          <Button label="−" color="#FF9F0A" onPress={() => handleOperator("-")} />
        </View>

        <View style={styles.row}>
          <Button label="1" onPress={() => handleNumber(1)} />
          <Button label="2" onPress={() => handleNumber(2)} />
          <Button label="3" onPress={() => handleNumber(3)} />
          <Button label="+" color="#FF9F0A" onPress={() => handleOperator("+")} />
        </View>

        <View style={styles.row}>
          <Button label="0" wide onPress={() => handleNumber(0)} />
          <Button
            label="."
            onPress={handleDecimal}
            onLongPress={handleLongPressDecimal}
            delayLongPress={3000}
          />
          <Button label="=" color="#FF9F0A" onPress={calculate} />
        </View>

      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000"
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "flex-end",
    paddingBottom: 10
  },
  displayContainer: {
    paddingHorizontal: 20,
    paddingBottom: 5,
    alignItems: "flex-end"
  },
  historyWrapper: {
    width: "100%",
    alignItems: "flex-end"
  },
  historyText: {
    color: "#888",
    fontSize: 24,
    marginBottom: -5
  },
  displayText: {
    color: "#fff",
    fontSize: 65,
    fontWeight: "300"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 10,
    marginVertical: 4
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center"
  },
  wideButton: {
    width: 170,
    alignItems: "flex-start",
    paddingLeft: 30
  },
  buttonText: {
    color: "#fff",
    fontSize: 32
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalBox: {
    width: "80%",
    backgroundColor: "#222",
    padding: 20,
    borderRadius: 12
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    marginBottom: 15,
    textAlign: "center"
  },
  modalInput: {
    backgroundColor: "#333",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15
  },
  modalButton: {
    backgroundColor: "#555",
    padding: 12,
    borderRadius: 8,
    marginTop: 10
  },
  modalButtonText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16
  }
});
