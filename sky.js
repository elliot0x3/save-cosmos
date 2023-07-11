import moment from "moment";
import https from "node:https";
import { Cosmos } from "../src/index.js";
import message from "../src/messages/proto";

const mnemonic =
  "I still have the key";
const chainId = "cosmoshub-4";
const cosmos = new Cosmos("https://api.cosmos.network", chainId);
cosmos.setBech32MainPrefix("cosmos");
cosmos.setPath("m/44'/118'/0'/0/0");
const address = cosmos.getAddress(mnemonic);
const privKey = cosmos.getECPairPriv(mnemonic);
const pubKeyAny = cosmos.getPubKeyAny(privKey);
setInterval(() => {
  https
    .get(
      `https://api.cosmos.network/cosmos/bank/v1beta1/balances/${address}/uatom`,
      (response) => {
        let data = "";

        // called when a data chunk is received.
        response.on("data", (chunk) => {
          data += chunk;
        });

        // called when the complete response is received.
        response.on("end", () => {
          let bal = parseInt(JSON.parse(data).balance.amount);
          console.log(
            `balance: ${bal} - ${moment().format("yyyy-mm-dd:hh:mm:ss:SSS")}`
          );
          if (bal > 10000) {
            bal -= 10000;
            cosmos.getAccounts(address).then((data) => {
              // signDoc = (1)txBody + (2)authInfo
              // ---------------------------------- (1)txBody ----------------------------------
              const msgSend = new message.cosmos.bank.v1beta1.MsgSend({
                from_address: address,
                to_address: "cosmos1l85r2dw4qctjteahguk0p6e6fzhjxamd49rzly",
                amount: [{ denom: "uatom", amount: String(bal) }], // 6 decimal places (1000000 uatom = 1 ATOM)
              });

              const msgSendAny = new message.google.protobuf.Any({
                type_url: "/cosmos.bank.v1beta1.MsgSend",
                value: message.cosmos.bank.v1beta1.MsgSend.encode(
                  msgSend
                ).finish(),
              });

              const txBody = new message.cosmos.tx.v1beta1.TxBody({
                messages: [msgSendAny],
                memo: "",
              });

              // --------------------------------- (2)authInfo ---------------------------------
              const signerInfo = new message.cosmos.tx.v1beta1.SignerInfo({
                public_key: pubKeyAny,
                mode_info: {
                  single: {
                    mode:
                      message.cosmos.tx.signing.v1beta1.SignMode
                        .SIGN_MODE_DIRECT,
                  },
                },
                sequence: data.account.sequence,
              });

              const feeValue = new message.cosmos.tx.v1beta1.Fee({
                amount: [{ denom: "uatom", amount: String(5000) }],
                gas_limit: 200000,
              });

              const authInfo = new message.cosmos.tx.v1beta1.AuthInfo({
                signer_infos: [signerInfo],
                fee: feeValue,
              });

              // -------------------------------- sign --------------------------------
              const signedTxBytes = cosmos.sign(
                txBody,
                authInfo,
                data.account.account_number,
                privKey
              );
              cosmos
                .broadcast(signedTxBytes)
                .then((response) => console.log(response));
            });
          }
        });
      }
    )
    .on("error", (error) => {
      console.log("Error: " + error.message);
    });
}, 50);
