use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize};

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub(super) struct Hex32(String);

impl Hex32 {
    pub(super) fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for Hex32 {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        let bytes =
            decode_lowercase_hex(&value, "32-byte hexadecimal value").map_err(D::Error::custom)?;
        if bytes.len() != 32 {
            return Err(D::Error::custom(
                "32-byte hexadecimal value must encode exactly 32 bytes",
            ));
        }
        Ok(Self(value))
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(transparent)]
pub(super) struct CommitSha(String);

impl CommitSha {
    pub(super) fn as_str(&self) -> &str {
        &self.0
    }
}

impl<'de> Deserialize<'de> for CommitSha {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        let bytes = decode_lowercase_hex(&value, "commit SHA").map_err(D::Error::custom)?;
        if bytes.len() != 20 {
            return Err(D::Error::custom("commit SHA must encode exactly 20 bytes"));
        }
        Ok(Self(value))
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(transparent)]
pub(super) struct HexBytes(String);

impl HexBytes {
    pub(super) fn as_str(&self) -> &str {
        &self.0
    }

    pub(super) fn bytes(&self) -> Vec<u8> {
        hex::decode(&self.0).expect("validated hexadecimal bytes must decode")
    }
}

impl<'de> Deserialize<'de> for HexBytes {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        decode_lowercase_hex(&value, "hexadecimal bytes").map_err(D::Error::custom)?;
        Ok(Self(value))
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(transparent)]
pub(super) struct Utf8Hex(String);

impl Utf8Hex {
    pub(super) fn bytes(&self) -> Vec<u8> {
        hex::decode(&self.0).expect("validated UTF-8 hexadecimal bytes must decode")
    }
}

impl<'de> Deserialize<'de> for Utf8Hex {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        let bytes =
            decode_lowercase_hex(&value, "UTF-8 hexadecimal bytes").map_err(D::Error::custom)?;
        std::str::from_utf8(&bytes)
            .map_err(|_| D::Error::custom("UTF-8 hexadecimal bytes must encode valid UTF-8"))?;
        Ok(Self(value))
    }
}

fn decode_lowercase_hex(value: &str, label: &str) -> Result<Vec<u8>, String> {
    if !value.len().is_multiple_of(2) {
        return Err(format!("{label} must contain an even number of digits"));
    }
    if !value
        .bytes()
        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(format!("{label} must contain lowercase hexadecimal only"));
    }
    hex::decode(value).map_err(|error| format!("{label} must decode: {error}"))
}
